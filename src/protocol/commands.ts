import {
  MAX_COMMAND_BYTES,
  OBSTACLE_MAX_CM,
  OBSTACLE_MIN_CM,
  SPEED_DEFAULT,
  SPEED_MAX,
  SPEED_MIN,
} from './constants';

export type Direction = 'forward' | 'backward' | 'left' | 'right';

export type CarCommand =
  | { kind: 'drive'; dir: Direction; speed: number }
  | { kind: 'stop' }
  /** Capability query. Firmware v2 answers `C:<version>,<hasUltrasonic>,<hasHorn>`. */
  | { kind: 'query' }
  /** Honk / locate, only sent when the car reports hasHorn. */
  | { kind: 'honk' }
  | { kind: 'locate' }
  /** Firmware v2 lift-off stop: `i1` on, `i0` off (car default off, resets on disconnect). */
  | { kind: 'liftStop'; on: boolean }
  /** Firmware v2 forward obstacle stop: `o<cm>` 10..100, `o0` off (resets on disconnect). */
  | { kind: 'obstacle'; cm: number }
  /** Firmware v2.1 car sounds: `m1` on (car default), `m0` off (resets on disconnect). */
  | { kind: 'carSounds'; on: boolean }
  /** Firmware v2.1 clap commands: `k1` on, `k0` off (car default off, resets on disconnect). */
  | { kind: 'clapMode'; on: boolean }
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

/** 0 (off) or a whole number of cm inside the firmware range (10..100). */
export function clampObstacle(cm: number): number {
  if (!Number.isFinite(cm) || cm <= 0) return 0;
  return Math.min(OBSTACLE_MAX_CM, Math.max(OBSTACLE_MIN_CM, Math.round(cm)));
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
    case 'liftStop':
      return cmd.on ? 'i1\n' : 'i0\n';
    case 'obstacle':
      return `o${clampObstacle(cmd.cm)}\n`;
    case 'carSounds':
      return cmd.on ? 'm1\n' : 'm0\n';
    case 'clapMode':
      return cmd.on ? 'k1\n' : 'k0\n';
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
