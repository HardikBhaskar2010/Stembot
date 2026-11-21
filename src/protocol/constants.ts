/**
 * The hardware contract with the car firmware (BBC micro:bit V2, MakeCode, Bluetooth UART).
 * Source of truth: the owner's brief and the GATT log from the real device.
 * See docs/PROTOCOL.md.
 */

/** Advertised name prefix of every micro:bit. */
export const NAME_PREFIX = 'BBC micro:bit';

/** Nordic-style UART service exposed by the MakeCode bluetooth extension. */
export const UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

/**
 * App -> car. OBSERVED on the real device: ...0003 accepts write / write-without-response.
 * Common docs label this the other way round (they name it from the micro:bit's side).
 */
export const UART_WRITE_CHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

/** Car -> app. OBSERVED: ...0002 supports indicate. */
export const UART_NOTIFY_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

/** One command per write, including the trailing newline. */
export const MAX_COMMAND_BYTES = 20;

export const SPEED_MIN = 200;
export const SPEED_MAX = 1023;
export const SPEED_DEFAULT = 600;
export const SPEED_STEP = 100;

/** The car stops itself if no drive letter arrives for this long. */
export const CAR_WATCHDOG_MS = 250;
/** Resend the held command this often (well inside the watchdog). */
export const KEEPALIVE_MS = 80;
/** A write that takes longer than this is abandoned so later commands (and stop) are not stuck behind it. */
export const WRITE_TIMEOUT_MS = 600;

/** Car telemetry period (approx). */
export const TELEMETRY_PERIOD_MS = 150;
/** No telemetry for this long = "Waiting for data". */
export const TELEMETRY_STALE_MS = 1000;

/** Quick-command pulse lengths. */
export const NUDGE_MS = 300;
export const SPIN_MS = 450;

/** Radar zones (cm). */
export const ZONE_CLOSE_CM = 50;
export const ZONE_VERY_CLOSE_CM = 20;
/** Largest distance we accept from an HC-SR04 style sensor (firmware times out near 430 cm). */
export const MAX_VALID_CM = 500;

/** Longest line we buffer from the car before assuming garbage. */
export const MAX_LINE_LENGTH = 64;

/** Pin map reference (read-only), measured on the owner's BMBRK V1.1 board, Nov 2026. */
export const PIN_MAP: ReadonlyArray<{ fn: string; pin: string; note: string }> = [
  { fn: 'Right wheel forward', pin: 'P8', note: 'PWM, P0 low' },
  { fn: 'Right wheel backward', pin: 'P0', note: 'PWM, P8 low' },
  { fn: 'Left wheel forward', pin: 'P16', note: 'PWM, P15 low' },
  { fn: 'Left wheel backward', pin: 'P15', note: 'PWM, P16 low' },
  { fn: 'Ultrasonic TRIG', pin: 'P1', note: 'HC-SR04 style' },
  { fn: 'Ultrasonic ECHO', pin: 'P2', note: 'pulseIn High, 25 ms timeout, cm = us / 58' },
  { fn: 'Bottom IR left', pin: 'P14', note: '0 = floor, 1 = no floor' },
  { fn: 'Bottom IR right', pin: 'P13', note: '0 = floor, 1 = no floor' },
  { fn: 'Unused by motors', pin: 'P12', note: '' },
];
