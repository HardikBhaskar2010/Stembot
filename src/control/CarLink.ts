import {
  encodeCommand,
  isDriveLine,
  toBytes,
  type CarCommand,
  type Direction,
} from '../protocol/commands';
import { KEEPALIVE_MS, WRITE_TIMEOUT_MS } from '../protocol/constants';

/** What a link needs from a connection. */
export interface Writer {
  write(data: Uint8Array): Promise<void>;
}

export interface LinkStats {
  sent: number;
  /** Commands replaced by a newer one before they were written (newest wins). */
  superseded: number;
  failed: number;
  timedOut: number;
  lastWriteMs: number;
  avgWriteMs: number;
}

export type LinkEvent =
  | { type: 'tx'; line: string; at: number; ms: number }
  | { type: 'superseded'; line: string; at: number }
  | { type: 'error'; line: string; at: number; message: string };

export interface CarLinkOptions {
  reversed: () => boolean;
  onEvent?: (e: LinkEvent) => void;
  keepAliveMs?: number;
  writeTimeoutMs?: number;
  now?: () => number;
}

/** Settings bursts are short (at most ~6 lines on connect); cap the queue anyway. */
const MAX_CONTROL_QUEUE = 16;

type Desired = { kind: 'stop' } | { kind: 'drive'; dir: Direction; speed: number };

/**
 * One car's command channel.
 *
 * - At most one write in flight. While it is in flight, only the newest command waits (newest wins).
 * - While a drive command is held, it is re-sent every 80 ms so the car's 250 ms watchdog stays fed.
 * - Release, stop, block and dispose all send `x` and kill the keep-alive and any pulse timer.
 * - A write that hangs is abandoned after WRITE_TIMEOUT_MS so a stop can never queue behind it forever.
 * Each car has its own link, so a slow car never delays a fast one.
 */
export class CarLink {
  private desired: Desired = { kind: 'stop' };
  private inFlight = false;
  /** Newest drive/stop line waiting for the link (newest wins). */
  private pending: string | null = null;
  /** Settings and other non-drive lines (i, o, m, k, ?, h, l, raw): in order, never dropped. */
  private control: string[] = [];
  private keepAlive: ReturnType<typeof setInterval> | null = null;
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private blocked = false;
  private disposed = false;
  private totalWriteMs = 0;
  readonly stats: LinkStats = {
    sent: 0,
    superseded: 0,
    failed: 0,
    timedOut: 0,
    lastWriteMs: 0,
    avgWriteMs: 0,
  };

  private readonly keepAliveMs: number;
  private readonly writeTimeoutMs: number;
  private readonly now: () => number;

  constructor(
    private readonly writer: Writer,
    private readonly opts: CarLinkOptions,
  ) {
    this.keepAliveMs = opts.keepAliveMs ?? KEEPALIVE_MS;
    this.writeTimeoutMs = opts.writeTimeoutMs ?? WRITE_TIMEOUT_MS;
    this.now = opts.now ?? (() => performance.now());
  }

  get isDriving(): boolean {
    return this.desired.kind === 'drive';
  }

  get isBlocked(): boolean {
    return this.blocked;
  }

  /** Start or change a held drive command. Ignored (and stops) while blocked. */
  hold(dir: Direction, speed: number): void {
    if (this.disposed) return;
    if (this.blocked) {
      this.stop();
      return;
    }
    const changed =
      this.desired.kind !== 'drive' || this.desired.dir !== dir || this.desired.speed !== speed;
    this.desired = { kind: 'drive', dir, speed };
    if (changed) this.enqueue(this.encodeDesired());
    this.ensureKeepAlive();
  }

  /** Let go of the control: stop now. */
  release(): void {
    this.stop();
  }

  stop(): void {
    if (this.disposed) return;
    this.clearPulse();
    this.clearKeepAlive();
    this.desired = { kind: 'stop' };
    this.enqueue(encodeCommand({ kind: 'stop' }));
  }

  /** Short fixed-length move (nudge / spin), then stop. Cancelled by any stop path. */
  pulse(dir: Direction, speed: number, ms: number): void {
    if (this.disposed || this.blocked) return;
    this.clearPulse();
    this.hold(dir, speed);
    this.pulseTimer = setTimeout(() => {
      this.pulseTimer = null;
      this.stop();
    }, ms);
  }

  /** Non-drive commands (query, honk, locate, raw). They share the queue so they never overlap a write. */
  send(cmd: Exclude<CarCommand, { kind: 'drive' }>): void {
    if (this.disposed) return;
    if (cmd.kind === 'stop') {
      this.stop();
      return;
    }
    this.enqueueControl(encodeCommand(cmd));
  }

  /** Lifted car or locked controls: stop and refuse drive commands until unblocked. */
  setBlocked(blocked: boolean): void {
    if (blocked === this.blocked) return;
    this.blocked = blocked;
    if (blocked) this.stop();
  }

  /** Final stop attempt, then no more writes. */
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.clearKeepAlive();
    this.clearPulse();
  }

  private encodeDesired(): string {
    return this.desired.kind === 'drive'
      ? encodeCommand(
          { kind: 'drive', dir: this.desired.dir, speed: this.desired.speed },
          { reversed: this.opts.reversed() },
        )
      : encodeCommand({ kind: 'stop' });
  }

  private ensureKeepAlive() {
    if (this.keepAlive) return;
    this.keepAlive = setInterval(() => {
      if (this.desired.kind !== 'drive' || this.blocked) {
        this.clearKeepAlive();
        return;
      }
      this.enqueue(this.encodeDesired());
    }, this.keepAliveMs);
  }

  private clearKeepAlive() {
    if (this.keepAlive) clearInterval(this.keepAlive);
    this.keepAlive = null;
  }

  private clearPulse() {
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
    this.pulseTimer = null;
  }

  /** Non-drive commands queue in order; a burst like i1, o20, m1 must all arrive. */
  private enqueueControl(line: string) {
    if (!this.inFlight) {
      void this.write(line);
      return;
    }
    if (this.control.length >= MAX_CONTROL_QUEUE) this.control.shift();
    this.control.push(line);
  }

  private enqueue(line: string) {
    if (this.inFlight) {
      if (this.pending !== null) {
        this.stats.superseded += 1;
        this.opts.onEvent?.({ type: 'superseded', line: this.pending, at: this.now() });
      }
      this.pending = line;
      return;
    }
    void this.write(line);
  }

  private async write(line: string): Promise<void> {
    if (this.disposed && line !== 'x\n') return;
    this.inFlight = true;
    const t0 = this.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const bytes = toBytes(line);
      await Promise.race([
        this.writer.write(bytes),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new LinkTimeout()), this.writeTimeoutMs);
        }),
      ]);
      const ms = this.now() - t0;
      this.stats.sent += 1;
      this.stats.lastWriteMs = ms;
      this.totalWriteMs += ms;
      this.stats.avgWriteMs = this.totalWriteMs / this.stats.sent;
      this.opts.onEvent?.({ type: 'tx', line, at: t0, ms });
    } catch (e) {
      if (e instanceof LinkTimeout) this.stats.timedOut += 1;
      else this.stats.failed += 1;
      this.opts.onEvent?.({
        type: 'error',
        line,
        at: t0,
        message: e instanceof Error ? e.message : String(e),
      });
      // A failed stop is retried once (unless something newer is already waiting).
      if (
        line === 'x\n' &&
        this.pending === null &&
        this.desired.kind === 'stop' &&
        !this.retriedStop
      ) {
        this.retriedStop = true;
        this.pending = line;
      }
    } finally {
      if (timer) clearTimeout(timer);
      this.inFlight = false;
      if (line === 'x\n' && this.pending !== 'x\n') this.retriedStop = false;
    }
    // Order after each write: a waiting STOP first (safety), then queued settings, then drive.
    if (this.pending === 'x\n') {
      this.pending = null;
      void this.write('x\n');
      return;
    }
    const ctl = this.control.shift();
    if (ctl !== undefined) {
      void this.write(ctl);
      return;
    }
    const next = this.pending;
    this.pending = null;
    if (next !== null) {
      // Do not resend a stale drive command once we are stopped.
      if (isDriveLine(next) && this.desired.kind !== 'drive') return;
      void this.write(next);
    }
  }

  private retriedStop = false;
}

class LinkTimeout extends Error {
  constructor() {
    super('Write took too long');
  }
}
