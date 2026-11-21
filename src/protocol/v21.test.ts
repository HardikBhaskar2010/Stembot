import { describe, expect, it } from 'vitest';
import { cardinal, relativeHeading } from '../ui/Compass';
import { encodeCommand } from './commands';
import { parseLine } from './telemetry';

describe('firmware v2.1 lines', () => {
  it('parses the 4-field capability reply and still accepts the 3-field one', () => {
    expect(parseLine('C:2.1,1,1,1')).toEqual({
      type: 'capabilities',
      value: { version: '2.1', hasUltrasonic: true, hasHorn: true, hasCompass: true },
    });
    expect(parseLine('C:2.0,0,1')).toEqual({
      type: 'capabilities',
      value: { version: '2.0', hasUltrasonic: false, hasHorn: true, hasCompass: false },
    });
    expect(parseLine('C:2.1,1,1,2').type).toBe('invalid');
  });

  it('parses motion lines; heading -1 means not calibrated', () => {
    expect(parseLine('M:42,-3,7,0')).toEqual({
      type: 'motion',
      value: { headingDeg: 42, pitchDeg: -3, rollDeg: 7, bump: false },
    });
    const m = parseLine('M:-1,0,0,1');
    expect(m.type === 'motion' && m.value.headingDeg).toBeNull();
    expect(m.type === 'motion' && m.value.bump).toBe(true);
    expect(parseLine('M:359,-180,180,0').type).toBe('motion');
  });

  it.each([
    ['M:360,0,0,0', 'heading out of range'],
    ['M:-2,0,0,0', 'heading out of range'],
    ['M:10,181,0,0', 'tilt out of range'],
    ['M:10,0,-999,0', 'tilt out of range'],
    ['M:10,0,0', 'bad motion format'],
    ['M:10,0,0,2', 'bad motion format'],
    ['M:1.5,0,0,0', 'bad motion format'],
    ['M:abc,0,0,0', 'bad motion format'],
  ])('rejects malformed motion %j', (line, reason) => {
    const p = parseLine(line);
    expect(p.type).toBe('invalid');
    expect(p.type === 'invalid' && p.reason).toBe(reason);
  });

  it('parses clap lines 1..3 only', () => {
    expect(parseLine('K:2')).toEqual({ type: 'clap', value: { claps: 2 } });
    expect(parseLine('K:0').type).toBe('invalid');
    expect(parseLine('K:4').type).toBe('invalid');
    expect(parseLine('K:').type).toBe('invalid');
  });

  it('encodes car sounds and clap mode commands', () => {
    expect(encodeCommand({ kind: 'carSounds', on: true })).toBe('m1\n');
    expect(encodeCommand({ kind: 'carSounds', on: false })).toBe('m0\n');
    expect(encodeCommand({ kind: 'clapMode', on: true })).toBe('k1\n');
    expect(encodeCommand({ kind: 'clapMode', on: false }, { reversed: true })).toBe('k0\n');
  });
});

describe('compass maths', () => {
  it('applies the per-car north offset and wraps', () => {
    expect(relativeHeading(90, 0)).toBe(90);
    expect(relativeHeading(10, 30)).toBe(340);
    expect(relativeHeading(359, 359)).toBe(0);
    expect(relativeHeading(45.6, 0)).toBe(46);
  });

  it('names the 8 compass points', () => {
    expect(cardinal(0)).toBe('N');
    expect(cardinal(22)).toBe('N');
    expect(cardinal(23)).toBe('NE');
    expect(cardinal(180)).toBe('S');
    expect(cardinal(337)).toBe('NW');
    expect(cardinal(338)).toBe('N');
  });
});
