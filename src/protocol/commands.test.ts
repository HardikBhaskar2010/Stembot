import { describe, expect, it } from 'vitest';
import {
  applyReverse,
  clampObstacle,
  clampSpeed,
  effectiveSpeed,
  encodeCommand,
  toBytes,
  CommandError,
} from './commands';

describe('encodeCommand', () => {
  it('encodes drive letters with speed and newline', () => {
    expect(encodeCommand({ kind: 'drive', dir: 'forward', speed: 700 })).toBe('w700\n');
    expect(encodeCommand({ kind: 'drive', dir: 'backward', speed: 700 })).toBe('s700\n');
    expect(encodeCommand({ kind: 'drive', dir: 'left', speed: 300 })).toBe('a300\n');
    expect(encodeCommand({ kind: 'drive', dir: 'right', speed: 1023 })).toBe('d1023\n');
  });

  it('encodes stop as x', () => {
    expect(encodeCommand({ kind: 'stop' })).toBe('x\n');
  });

  it('swaps w<->s and a<->d for reversed cars', () => {
    expect(encodeCommand({ kind: 'drive', dir: 'forward', speed: 500 }, { reversed: true })).toBe(
      's500\n',
    );
    expect(encodeCommand({ kind: 'drive', dir: 'backward', speed: 500 }, { reversed: true })).toBe(
      'w500\n',
    );
    expect(encodeCommand({ kind: 'drive', dir: 'left', speed: 500 }, { reversed: true })).toBe(
      'd500\n',
    );
    expect(encodeCommand({ kind: 'drive', dir: 'right', speed: 500 }, { reversed: true })).toBe(
      'a500\n',
    );
    expect(encodeCommand({ kind: 'stop' }, { reversed: true })).toBe('x\n');
    expect(applyReverse('forward', false)).toBe('forward');
  });

  it('clamps speed to 200..1023', () => {
    expect(encodeCommand({ kind: 'drive', dir: 'forward', speed: 50 })).toBe('w200\n');
    expect(encodeCommand({ kind: 'drive', dir: 'forward', speed: 99999 })).toBe('w1023\n');
    expect(clampSpeed(Number.NaN)).toBe(600);
    expect(clampSpeed(612.6)).toBe(613);
  });

  it('applies speed modes per car and stays in range', () => {
    expect(effectiveSpeed(600, 'normal')).toBe(600);
    expect(effectiveSpeed(600, 'slow')).toBe(360);
    expect(effectiveSpeed(900, 'turbo')).toBe(1023);
    expect(effectiveSpeed(250, 'slow')).toBe(200);
  });

  it('validates raw dev commands', () => {
    expect(encodeCommand({ kind: 'raw', text: 'w500' })).toBe('w500\n');
    expect(encodeCommand({ kind: 'raw', text: 'w500\n' })).toBe('w500\n');
    expect(() => encodeCommand({ kind: 'raw', text: '' })).toThrow(CommandError);
    expect(() => encodeCommand({ kind: 'raw', text: 'x'.repeat(20) })).toThrow(CommandError);
    expect(() => encodeCommand({ kind: 'raw', text: 'w\u0000' })).toThrow(CommandError);
    expect(() => encodeCommand({ kind: 'raw', text: 'héllo' })).toThrow(CommandError);
    expect(() => encodeCommand({ kind: 'raw', text: 'a\nb' })).toThrow(CommandError);
  });

  it('never produces a write over 20 bytes', () => {
    for (const dir of ['forward', 'backward', 'left', 'right'] as const) {
      for (const speed of [-1, 0, 200, 1023, 1e9]) {
        expect(toBytes(encodeCommand({ kind: 'drive', dir, speed })).length).toBeLessThanOrEqual(
          20,
        );
      }
    }
    expect(() => toBytes('y'.repeat(21))).toThrow(CommandError);
  });

  it('encodes firmware v2 lift-off stop as i1 / i0', () => {
    expect(encodeCommand({ kind: 'liftStop', on: true })).toBe('i1\n');
    expect(encodeCommand({ kind: 'liftStop', on: false })).toBe('i0\n');
  });

  it('encodes firmware v2 obstacle stop as o<cm> within 10..100, o0 = off', () => {
    expect(encodeCommand({ kind: 'obstacle', cm: 30 })).toBe('o30\n');
    expect(encodeCommand({ kind: 'obstacle', cm: 0 })).toBe('o0\n');
    expect(encodeCommand({ kind: 'obstacle', cm: 5 })).toBe('o10\n');
    expect(encodeCommand({ kind: 'obstacle', cm: 250 })).toBe('o100\n');
    expect(encodeCommand({ kind: 'obstacle', cm: -3 })).toBe('o0\n');
    expect(encodeCommand({ kind: 'obstacle', cm: Number.NaN })).toBe('o0\n');
    expect(clampObstacle(49.6)).toBe(50);
    expect(toBytes(encodeCommand({ kind: 'obstacle', cm: 100 })).length).toBeLessThanOrEqual(20);
  });

  it('reverse wheels never changes i / o commands', () => {
    expect(encodeCommand({ kind: 'liftStop', on: true }, { reversed: true })).toBe('i1\n');
    expect(encodeCommand({ kind: 'obstacle', cm: 20 }, { reversed: true })).toBe('o20\n');
  });
});
