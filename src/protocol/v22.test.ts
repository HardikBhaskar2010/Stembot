import { describe, expect, it } from 'vitest';
import { matchVoice } from '../voice/phrases';
import { encodeCommand } from './commands';
import { firmwareAtLeast, parseLine } from './telemetry';

describe('firmware v2.2: steps and runtime wheel flip', () => {
  it('encodes heading-hold steps with distance and speed', () => {
    expect(encodeCommand({ kind: 'step', dir: 'forward', cm: 10, speed: 600 })).toBe('f10,600\n');
    expect(encodeCommand({ kind: 'step', dir: 'backward', cm: 10, speed: 700 })).toBe('b10,700\n');
    expect(encodeCommand({ kind: 'step', dir: 'forward', cm: 0, speed: 50 })).toBe('f1,200\n');
    expect(encodeCommand({ kind: 'step', dir: 'forward', cm: 250, speed: 5000 })).toBe(
      'f100,1023\n',
    );
    expect(encodeCommand({ kind: 'step', dir: 'forward', cm: Number.NaN, speed: 600 })).toBe(
      'f10,600\n',
    );
  });

  it('a step is never swapped by app-side reverse (the firmware flips v2.2 cars)', () => {
    expect(
      encodeCommand({ kind: 'step', dir: 'forward', cm: 10, speed: 600 }, { reversed: true }),
    ).toBe('f10,600\n');
  });

  it('encodes the runtime wheel flip', () => {
    expect(encodeCommand({ kind: 'wheelFlip', on: true })).toBe('r1\n');
    expect(encodeCommand({ kind: 'wheelFlip', on: false })).toBe('r0\n');
  });

  it('parses step results', () => {
    expect(parseLine('S:10,d')).toEqual({ type: 'step', value: { movedCm: 10, why: 'd' } });
    expect(parseLine('S:6,o')).toEqual({ type: 'step', value: { movedCm: 6, why: 'o' } });
    expect(parseLine('S:0,x').type).toBe('step');
  });

  it.each(['S:', 'S:10', 'S:10,q', 'S:-1,d', 'S:1000,d', 'S:10,dd'])('rejects %j', (line) => {
    expect(parseLine(line).type).toBe('invalid');
  });

  it('compares firmware versions numerically', () => {
    const caps = (version: string) => ({
      version,
      hasUltrasonic: true,
      hasHorn: true,
      hasCompass: true,
    });
    expect(firmwareAtLeast(caps('2.2'), 2.2)).toBe(true);
    expect(firmwareAtLeast(caps('2.10'), 2.2)).toBe(false); // "2.10" parses as 2.1: be conservative
    expect(firmwareAtLeast(caps('3.0'), 2.2)).toBe(true);
    expect(firmwareAtLeast(caps('2.1'), 2.2)).toBe(false);
    expect(firmwareAtLeast(caps('beta'), 2.2)).toBe(false);
    expect(firmwareAtLeast(null, 2.2)).toBe(false);
  });

  it('voice: step / inch commands', () => {
    expect(matchVoice('step forward')).toEqual({ type: 'step', dir: 'forward' });
    expect(matchVoice('step')).toEqual({ type: 'step', dir: 'forward' });
    expect(matchVoice('step back')).toEqual({ type: 'step', dir: 'backward' });
    expect(matchVoice('inch backwards')).toEqual({ type: 'step', dir: 'backward' });
    expect(matchVoice('step forward then stop')).toEqual({ type: 'stop' });
  });
});
