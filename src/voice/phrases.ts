import type { Direction, SpeedMode } from '../protocol/commands';

/** What a spoken phrase asks for. Voice never unlocks controls (safety). */
export type VoiceAction =
  | { type: 'stop' }
  | { type: 'move'; dir: Direction }
  | { type: 'spin'; dir: 'left' | 'right' }
  | { type: 'speed'; delta: 1 | -1 }
  | { type: 'mode'; mode: SpeedMode }
  | { type: 'honk' }
  | { type: 'locate' }
  | { type: 'lock' };

const STOP = /\b(stop|halt|freeze|whoa|brake|stay)\b/;

function words(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

/** True as soon as a (partial) transcript contains a stop word: acted on before the phrase ends. */
export function hasStopWord(transcript: string): boolean {
  return STOP.test(words(transcript));
}

/**
 * Map a transcript to one action. "Stop" always wins, so "go forward no stop" stops.
 * Order matters for overlaps: "slow down" before "slow", "go back" before "go".
 */
export function matchVoice(transcript: string): VoiceAction | null {
  const w = words(transcript);
  if (STOP.test(w)) return { type: 'stop' };
  if (/\bunlock\b/.test(w)) return null;
  if (/\block\b/.test(w)) return { type: 'lock' };
  if (/\b(honk|beep|horn|toot)\b/.test(w)) return { type: 'honk' };
  if (/\b(find|locate|where)\b/.test(w)) return { type: 'locate' };
  if (/\bturbo\b/.test(w)) return { type: 'mode', mode: 'turbo' };
  if (/\b(faster|speed up|quicker)\b/.test(w)) return { type: 'speed', delta: 1 };
  if (/\b(slower|slow down)\b/.test(w)) return { type: 'speed', delta: -1 };
  if (/\b(slow mode|slow)\b/.test(w)) return { type: 'mode', mode: 'slow' };
  if (/\bnormal\b/.test(w)) return { type: 'mode', mode: 'normal' };
  if (/\b(spin|turn around|rotate)\b/.test(w)) {
    return { type: 'spin', dir: /\bleft\b/.test(w) ? 'left' : 'right' };
  }
  if (/\b(back|backward|backwards|reverse)\b/.test(w)) return { type: 'move', dir: 'backward' };
  if (/\bleft\b/.test(w)) return { type: 'move', dir: 'left' };
  if (/\bright\b/.test(w)) return { type: 'move', dir: 'right' };
  if (/\b(forward|forwards|go|ahead|straight|drive)\b/.test(w))
    return { type: 'move', dir: 'forward' };
  return null;
}
