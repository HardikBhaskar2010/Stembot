import { describe, expect, it } from 'vitest';
import { hasStopWord, matchVoice } from './phrases';

describe('voice phrase matcher', () => {
  it.each([
    ['stop', { type: 'stop' }],
    ['STOP!', { type: 'stop' }],
    ['halt please', { type: 'stop' }],
    ['go forward no stop', { type: 'stop' }],
    ['forward', { type: 'move', dir: 'forward' }],
    ['go', { type: 'move', dir: 'forward' }],
    ['go ahead', { type: 'move', dir: 'forward' }],
    ['go back', { type: 'move', dir: 'backward' }],
    ['reverse', { type: 'move', dir: 'backward' }],
    ['turn left', { type: 'move', dir: 'left' }],
    ['right', { type: 'move', dir: 'right' }],
    ['spin left', { type: 'spin', dir: 'left' }],
    ['spin', { type: 'spin', dir: 'right' }],
    ['turn around', { type: 'spin', dir: 'right' }],
    ['faster', { type: 'speed', delta: 1 }],
    ['speed up', { type: 'speed', delta: 1 }],
    ['slow down', { type: 'speed', delta: -1 }],
    ['slower', { type: 'speed', delta: -1 }],
    ['slow', { type: 'mode', mode: 'slow' }],
    ['turbo', { type: 'mode', mode: 'turbo' }],
    ['normal speed', { type: 'mode', mode: 'normal' }],
    ['honk', { type: 'honk' }],
    ['beep beep', { type: 'honk' }],
    ['where are you', { type: 'locate' }],
    ['lock controls', { type: 'lock' }],
  ])('%j', (text, expected) => {
    expect(matchVoice(text)).toEqual(expected);
  });

  it('never unlocks by voice', () => {
    expect(matchVoice('unlock')).toBeNull();
    expect(matchVoice('unlock controls')).toBeNull();
  });

  it('ignores phrases with no command', () => {
    expect(matchVoice('hello robot')).toBeNull();
    expect(matchVoice('')).toBeNull();
    expect(matchVoice('alright')).toBeNull();
  });

  it('spots stop words in partial transcripts', () => {
    expect(hasStopWord('go forward and st')).toBe(false);
    expect(hasStopWord('go forward and stop')).toBe(true);
    expect(hasStopWord('Freeze')).toBe(true);
    expect(hasStopWord('stopwatch')).toBe(false);
  });
});
