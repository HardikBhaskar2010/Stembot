/**
 * The only Bluetooth surface the rest of the app sees. UI and control code import from here,
 * never from navigator.bluetooth or the Capacitor plugin (enforced by ESLint).
 */

export type TransportKind = 'web-bluetooth' | 'capacitor-ble' | 'mock';

export type SupportResult =
  { ok: true } | { ok: false; reason: 'unsupported' | 'insecure' | 'bluetooth-off' };

export type TransportErrorCode =
  | 'cancelled'
  | 'permission-denied'
  | 'bluetooth-off'
  | 'unsupported'
  | 'not-found'
  | 'needs-picker'
  | 'connect-failed'
  | 'write-failed'
  | 'timeout';

export class TransportError extends Error {
  readonly code: TransportErrorCode;
  constructor(code: TransportErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'TransportError';
  }
}

export interface DeviceInfo {
  /** Stable id from the platform (Web Bluetooth device id, Android MAC, iOS UUID, mock id). */
  id: string;
  name: string;
}

export interface CharacteristicDescription {
  uuid: string;
  properties: string[];
}

export interface ServiceDescription {
  uuid: string;
  characteristics: CharacteristicDescription[];
}

export interface ConnectionHandlers {
  /** Raw bytes from the notify/indicate characteristic. Untrusted. */
  onData(chunk: Uint8Array): void;
  /** Link lost (not called for a disconnect we asked for). */
  onDisconnect(): void;
}

export interface CarConnection {
  readonly device: DeviceInfo;
  /** One write; the caller guarantees at most one in flight per connection. */
  write(data: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
  describe(): Promise<ServiceDescription[]>;
}

export interface CarTransport {
  readonly kind: TransportKind;
  checkSupport(): Promise<SupportResult>;
  /** Opens the system chooser. Must be called from a user gesture on the web. */
  requestDevice(): Promise<DeviceInfo>;
  /** True if `connect(id)` can work without showing the chooser again. */
  canReconnect(deviceId: string): Promise<boolean>;
  connect(deviceId: string, handlers: ConnectionHandlers): Promise<CarConnection>;
}

export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  code: TransportErrorCode = 'timeout',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TransportError(code, `Timed out after ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
