import { MAX_LINE_LENGTH, MAX_VALID_CM } from './constants';

/** Parsed `D:<cm>,<irL>,<irR>,<air>` line. Everything from the car is untrusted. */
export interface Telemetry {
  /** null = no echo or no sensor (the car sent 0). Never treat that as 0 cm. */
  distanceCm: number | null;
  /** true = this IR sensor sees no floor. */
  irLeftNoFloor: boolean;
  irRightNoFloor: boolean;
  /** Car reports it is lifted: it has stopped itself and ignores drive commands. */
  lifted: boolean;
}

/** Proposed firmware handshake `C:<version>,<hasUltrasonic>,<hasHorn>`. */
export interface Capabilities {
  version: string;
  hasUltrasonic: boolean;
  hasHorn: boolean;
}

export type ParsedLine =
  | { type: 'telemetry'; value: Telemetry }
  | { type: 'capabilities'; value: Capabilities }
  | { type: 'unknown'; raw: string }
  | { type: 'invalid'; raw: string; reason: string };

const TELEMETRY_RE = /^D:(\d{1,4}),([01]),([01]),([01])$/;
const CAPS_RE = /^C:([0-9A-Za-z.-]{1,8}),([01]),([01])$/;
const PRINTABLE = /^[\x20-\x7e]*$/;

export function parseLine(input: string): ParsedLine {
  const raw = input.replace(/\r$/, '');
  if (raw.length > MAX_LINE_LENGTH)
    return { type: 'invalid', raw: raw.slice(0, 32), reason: 'too long' };
  if (!PRINTABLE.test(raw))
    return { type: 'invalid', raw: sanitize(raw), reason: 'non-printable bytes' };

  if (raw.startsWith('D:')) {
    const m = TELEMETRY_RE.exec(raw);
    if (!m) return { type: 'invalid', raw, reason: 'bad telemetry format' };
    const cm = Number(m[1]);
    if (cm > MAX_VALID_CM) return { type: 'invalid', raw, reason: 'distance out of range' };
    return {
      type: 'telemetry',
      value: {
        distanceCm: cm === 0 ? null : cm,
        irLeftNoFloor: m[2] === '1',
        irRightNoFloor: m[3] === '1',
        lifted: m[4] === '1',
      },
    };
  }

  if (raw.startsWith('C:')) {
    const m = CAPS_RE.exec(raw);
    if (!m) return { type: 'invalid', raw, reason: 'bad capability format' };
    return {
      type: 'capabilities',
      value: { version: m[1] ?? '?', hasUltrasonic: m[2] === '1', hasHorn: m[3] === '1' },
    };
  }

  return { type: 'unknown', raw };
}

/** Replace anything non-printable so it can be shown safely in the dev log. */
export function sanitize(text: string): string {
  return text.replace(
    /[^\x20-\x7e]/g,
    (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`,
  );
}

/**
 * Reassembles newline-terminated lines from Bluetooth chunks (a line may arrive split,
 * and one chunk may hold several lines). Drops the buffer if it grows past MAX_LINE_LENGTH.
 */
export class LineAssembler {
  private buffer = '';
  private readonly decoder = new TextDecoder('utf-8', { fatal: false });
  overflows = 0;

  push(chunk: Uint8Array | string): string[] {
    this.buffer += typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true });
    const lines: string[] = [];
    let idx = this.buffer.indexOf('\n');
    while (idx !== -1) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      if (line.length > 0 && line !== '\r') lines.push(line);
      idx = this.buffer.indexOf('\n');
    }
    if (this.buffer.length > MAX_LINE_LENGTH) {
      this.buffer = '';
      this.overflows += 1;
    }
    return lines;
  }

  reset(): void {
    this.buffer = '';
  }
}
