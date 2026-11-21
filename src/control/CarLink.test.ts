import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CarLink, type Writer } from './CarLink';

const dec = new TextDecoder();

/** A fake connection whose writes resolve after `latency` ms (fake timers). */
function fakeWriter(latency = 5, fail?: (line: string) => boolean) {
  const lines: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const w: Writer = {
    write(data) {
      const line = dec.decode(data);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          inFlight -= 1;
          if (fail?.(line)) reject(new Error('boom'));
          else {
            lines.push(line);
            resolve();
          }
        }, latency);
      });
    },
  };
  return {
    w,
    lines,
    get maxInFlight() {
      return maxInFlight;
    },
  };
}

function hangingWriter() {
  const lines: string[] = [];
  let calls = 0;
  const w: Writer = {
    write(data) {
      calls += 1;
      const line = dec.decode(data);
      // First write never resolves; later writes succeed.
      if (calls === 1) return new Promise<void>(() => undefined);
      lines.push(line);
      return Promise.resolve();
    },
  };
  return { w, lines };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('CarLink', () => {
  it('sends a drive command immediately and keeps it alive every 80 ms', async () => {
    const f = fakeWriter(2);
    const link = new CarLink(f.w, { reversed: () => false });
    link.hold('forward', 700);
    await vi.advanceTimersByTimeAsync(5);
    expect(f.lines).toEqual(['w700\n']);
    await vi.advanceTimersByTimeAsync(400);
    // 400 ms / 80 ms = 5 keep-alives
    expect(f.lines.filter((l) => l === 'w700\n').length).toBeGreaterThanOrEqual(5);
    // gaps never exceed the car's 250 ms watchdog
    link.release();
    await vi.advanceTimersByTimeAsync(10);
    expect(f.lines.at(-1)).toBe('x\n');
  });

  it('stops sending keep-alives after release', async () => {
    const f = fakeWriter(2);
    const link = new CarLink(f.w, { reversed: () => false });
    link.hold('left', 500);
    await vi.advanceTimersByTimeAsync(100);
    link.release();
    await vi.advanceTimersByTimeAsync(10);
    const count = f.lines.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.lines.length).toBe(count);
    expect(f.lines.at(-1)).toBe('x\n');
  });

  it('never has more than one write in flight and the newest command wins', async () => {
    const f = fakeWriter(50);
    const link = new CarLink(f.w, { reversed: () => false });
    link.hold('forward', 300);
    link.hold('left', 300);
    link.hold('right', 300);
    link.hold('backward', 300);
    await vi.advanceTimersByTimeAsync(120);
    expect(f.maxInFlight).toBe(1);
    // first write, then only the newest of the queued ones
    expect(f.lines.slice(0, 2)).toEqual(['w300\n', 's300\n']);
    expect(link.stats.superseded).toBe(2);
    link.release();
    await vi.advanceTimersByTimeAsync(200);
    expect(f.lines.at(-1)).toBe('x\n');
  });

  it('stop replaces a pending drive command and nothing drives after it', async () => {
    const f = fakeWriter(40);
    const link = new CarLink(f.w, { reversed: () => false });
    link.hold('forward', 600);
    link.hold('right', 600); // pending
    link.stop(); // replaces pending
    await vi.advanceTimersByTimeAsync(500);
    expect(f.lines).toEqual(['w600\n', 'x\n']);
  });

  it('applies reverse wheels at send time', async () => {
    const f = fakeWriter(1);
    let reversed = true;
    const link = new CarLink(f.w, { reversed: () => reversed });
    link.hold('forward', 400);
    await vi.advanceTimersByTimeAsync(5);
    expect(f.lines[0]).toBe('s400\n');
    reversed = false;
    await vi.advanceTimersByTimeAsync(80);
    expect(f.lines.at(-1)).toBe('w400\n');
    link.dispose();
  });

  it('a pulse sends drive then stop after its duration, with keep-alive in between', async () => {
    const f = fakeWriter(1);
    const link = new CarLink(f.w, { reversed: () => false });
    link.pulse('forward', 500, 300);
    await vi.advanceTimersByTimeAsync(250);
    expect(f.lines.every((l) => l === 'w500\n')).toBe(true);
    expect(f.lines.length).toBeGreaterThanOrEqual(3);
    await vi.advanceTimersByTimeAsync(100);
    expect(f.lines.at(-1)).toBe('x\n');
    const n = f.lines.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(f.lines.length).toBe(n);
  });

  it('stop cancels a running pulse', async () => {
    const f = fakeWriter(1);
    const link = new CarLink(f.w, { reversed: () => false });
    link.pulse('left', 500, 1000);
    await vi.advanceTimersByTimeAsync(100);
    link.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(f.lines.at(-1)).toBe('x\n');
    expect(f.lines.filter((l) => l === 'x\n').length).toBe(1);
  });

  it('blocked (lifted or locked) links stop and refuse to drive', async () => {
    const f = fakeWriter(1);
    const link = new CarLink(f.w, { reversed: () => false });
    link.hold('forward', 500);
    await vi.advanceTimersByTimeAsync(5);
    link.setBlocked(true);
    await vi.advanceTimersByTimeAsync(5);
    expect(f.lines.at(-1)).toBe('x\n');
    link.hold('forward', 500);
    link.pulse('forward', 500, 300);
    await vi.advanceTimersByTimeAsync(500);
    expect(f.lines.filter((l) => l.startsWith('w')).length).toBe(1);
    link.setBlocked(false);
    link.hold('forward', 500);
    await vi.advanceTimersByTimeAsync(5);
    expect(f.lines.at(-1)).toBe('w500\n');
    link.dispose();
  });

  it('a hanging write is abandoned so stop still goes out', async () => {
    const h = hangingWriter();
    const link = new CarLink(h.w, { reversed: () => false, writeTimeoutMs: 600 });
    link.hold('forward', 500); // hangs
    link.stop(); // pending behind it
    await vi.advanceTimersByTimeAsync(700);
    expect(h.lines).toEqual(['x\n']);
    expect(link.stats.timedOut).toBe(1);
  });

  it('retries a failed stop once', async () => {
    let failures = 0;
    const f = fakeWriter(1, (l) => l === 'x\n' && failures++ === 0);
    const link = new CarLink(f.w, { reversed: () => false });
    link.stop();
    await vi.advanceTimersByTimeAsync(20);
    expect(f.lines).toEqual(['x\n']);
    expect(link.stats.failed).toBe(1);
  });

  it('dispose sends a final stop and then goes silent', async () => {
    const f = fakeWriter(1);
    const link = new CarLink(f.w, { reversed: () => false });
    link.hold('backward', 800);
    await vi.advanceTimersByTimeAsync(5);
    link.dispose();
    await vi.advanceTimersByTimeAsync(10);
    expect(f.lines.at(-1)).toBe('x\n');
    link.hold('forward', 800);
    await vi.advanceTimersByTimeAsync(500);
    expect(f.lines.at(-1)).toBe('x\n');
  });

  it('a slow car does not delay a fast one (independent links)', async () => {
    const slow = fakeWriter(200);
    const fast = fakeWriter(5);
    const a = new CarLink(slow.w, { reversed: () => false });
    const b = new CarLink(fast.w, { reversed: () => false });
    a.hold('forward', 500);
    b.hold('forward', 500);
    await vi.advanceTimersByTimeAsync(170);
    expect(fast.lines.length).toBeGreaterThanOrEqual(2);
    expect(slow.lines.length).toBe(0);
    a.stop();
    b.stop();
    await vi.advanceTimersByTimeAsync(600);
    expect(slow.lines.at(-1)).toBe('x\n');
    expect(fast.lines.at(-1)).toBe('x\n');
  });

  it('keeps the gap between drive writes under the 250 ms watchdog even with 60 ms writes', async () => {
    const times: number[] = [];
    const w: Writer = {
      write: () =>
        new Promise<void>((r) =>
          setTimeout(() => {
            times.push(Date.now());
            r();
          }, 60),
        ),
    };
    const link = new CarLink(w, { reversed: () => false });
    link.hold('forward', 500);
    await vi.advanceTimersByTimeAsync(2000);
    link.release();
    const gaps = times.slice(1).map((t, i) => t - times[i]!);
    expect(Math.max(...gaps)).toBeLessThan(250);
  });
});
