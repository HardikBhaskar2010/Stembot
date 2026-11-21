import { MAX_COMMAND_BYTES, SPEED_DEFAULT, SPEED_MAX, SPEED_MIN } from './constants';

export type Direction = 'forward' | 'backward' | 'left' | 'right';

export type CarCommand =
  | { kind: 'drive'; dir: Direction; speed: number }
  | { kind: 'stop' }
  /** Capability query. Current firmware ignores it (TO VALIDATE); proposed firmware answers `C:...`. */
  | { kind: 'query' }
  /** Proposed firmware commands, only sent when the car reports the capability. */
  | { kind: 'honk' }
  | { kind: 'locate' }
  /** Dev options: any printable ASCII string. */
  | { kind: 'raw'; text: string };

export type SpeedMode = 'slow' | 'normal' | 'turbo';

export const SPEED_MODE_FACTOR: Record<SpeedMode, number> = {
  slow: 0.6,
  normal: 1,
  turbo: 1.4,
};

const LETTER: Record<Direction, string> = {
  forward: 'w',
  backward: 's',
  left: 'a',
  right: 'd',
};

const MIRROR: Record<Direction, Direction> = {
  forward: 'backward',
  backward: 'forward',
  left: 'right',
  right: 'left',
};

/**
 * Cars with wheels wired the other way: swap w<->s and a<->d in the app,
 * so no reflash is needed. (Firmware also has a FLIP constant.)
 */
export function applyReverse(dir: Direction, reversed: boolean): Direction {
  return reversed ? MIRROR[dir] : dir;
}

export function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return SPEED_DEFAULT;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(speed)));
}

/** Per-car base speed scaled by the global mode, clamped to the firmware range. */
export function effectiveSpeed(carSpeed: number, mode: SpeedMode): number {
  return clampSpeed(clampSpeed(carSpeed) * SPEED_MODE_FACTOR[mode]);
}

const PRINTABLE = /^[\x20-\x7e]*$/;

export class CommandError extends Error {}

/** Encodes a command as the exact text line sent to the car (always ends with \n). */
export function encodeCommand(cmd: CarCommand, opts: { reversed?: boolean } = {}): string {
  switch (cmd.kind) {
    case 'drive': {
      const dir = applyReverse(cmd.dir, opts.reversed ?? false);
      return `${LETTER[dir]}${clampSpeed(cmd.speed)}\n`;
    }
    case 'stop':
      return 'x\n';
    case 'query':
      return '?\n';
    case 'honk':
      return 'h\n';
    case 'locate':
      return 'l\n';
    case 'raw': {
      const text = cmd.text.replace(/[\r\n]+$/g, '');
      if (!PRINTABLE.test(text))
        throw new CommandError('Only plain letters, digits and symbols can be sent.');
      if (text.length === 0) throw new CommandError('Type a command first.');
      if (text.length + 1 > MAX_COMMAND_BYTES)
        throw new CommandError(`Commands can be at most ${MAX_COMMAND_BYTES - 1} characters.`);
      return `${text}\n`;
    }
  }
}

const encoder = new TextEncoder();

export function toBytes(line: string): Uint8Array {
  const bytes = encoder.encode(line);
  if (bytes.length > MAX_COMMAND_BYTES)
    throw new CommandError('Command too long for one Bluetooth write.');
  return bytes;
}

export function isDriveLine(line: string): boolean {
  return /^[wsad]\d*\n$/.test(line);
}
