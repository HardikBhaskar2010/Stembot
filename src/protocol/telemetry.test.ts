import { describe, expect, it } from 'vitest';
import { LineAssembler, parseLine } from './telemetry';

describe('parseLine', () => {
  it('parses a normal telemetry line', () => {
    expect(parseLine('D:12,0,0,0')).toEqual({
      type: 'telemetry',
      value: { distanceCm: 12, irLeftNoFloor: false, irRightNoFloor: false, lifted: false },
    });
  });

  it('treats cm = 0 as no echo, never as 0 cm', () => {
    const p = parseLine('D:0,0,0,0');
    expect(p.type === 'telemetry' && p.value.distanceCm).toBeNull();
  });

  it('reports lifted', () => {
    const p = parseLine('D:34,1,1,1');
    expect(p.type === 'telemetry' && p.value.lifted).toBe(true);
  });

  it('accepts a trailing carriage return', () => {
    expect(parseLine('D:40,0,1,0\r').type).toBe('telemetry');
  });

  it('parses the v2.0 capability line (no compass field)', () => {
    expect(parseLine('C:2.0,1,0')).toEqual({
      type: 'capabilities',
      value: { version: '2.0', hasUltrasonic: true, hasHorn: false, hasCompass: false },
    });
  });

  it.each([
    ['D:', 'bad telemetry format'],
    ['D:12,0,0', 'bad telemetry format'],
    ['D:12,0,0,0,0', 'bad telemetry format'],
    ['D:-5,0,0,0', 'bad telemetry format'],
    ['D:12,2,0,0', 'bad telemetry format'],
    ['D:12.5,0,0,0', 'bad telemetry format'],
    ['D:12345,0,0,0', 'bad telemetry format'],
    ['D:999,0,0,0', 'distance out of range'],
    ['D: 12,0,0,0', 'bad telemetry format'],
    ['D:1e3,0,0,0', 'bad telemetry format'],
    ['C:,1,1', 'bad capability format'],
    ['C:1.0,yes,1', 'bad capability format'],
    ['D:12,0,0,0\u0000', 'non-printable bytes'],
    ['D:' + '1'.repeat(80), 'too long'],
  ])('rejects malformed %j', (line, reason) => {
    const p = parseLine(line);
    expect(p.type).toBe('invalid');
    expect(p.type === 'invalid' && p.reason).toBe(reason);
  });

  it('passes unknown printable lines through as unknown', () => {
    expect(parseLine('hello')).toEqual({ type: 'unknown', raw: 'hello' });
  });
});

describe('LineAssembler', () => {
  const enc = new TextEncoder();

  it('joins a line split across chunks', () => {
    const a = new LineAssembler();
    expect(a.push(enc.encode('D:1'))).toEqual([]);
    expect(a.push(enc.encode('2,0,0,0\n'))).toEqual(['D:12,0,0,0']);
  });

  it('splits several lines in one chunk and keeps the remainder', () => {
    const a = new LineAssembler();
    expect(a.push('D:1,0,0,0\nD:2,0,0,0\nD:3')).toEqual(['D:1,0,0,0', 'D:2,0,0,0']);
    expect(a.push(',0,0,0\n')).toEqual(['D:3,0,0,0']);
  });

  it('skips empty lines', () => {
    expect(new LineAssembler().push('\n\r\nD:5,0,0,0\n')).toEqual(['D:5,0,0,0']);
  });

  it('drops a runaway buffer with no newline', () => {
    const a = new LineAssembler();
    a.push('z'.repeat(100));
    expect(a.overflows).toBe(1);
    expect(a.push('D:5,0,0,0\n')).toEqual(['D:5,0,0,0']);
  });

  it('survives invalid UTF-8 bytes', () => {
    const a = new LineAssembler();
    const lines = a.push(new Uint8Array([0xff, 0xfe, 0x0a]));
    expect(lines).toHaveLength(1);
    expect(parseLine(lines[0]!).type).toBe('invalid');
  });
});
