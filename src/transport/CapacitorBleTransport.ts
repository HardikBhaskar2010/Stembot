import type { BleClientInterface } from '@capacitor-community/bluetooth-le';
import {
  NAME_PREFIX,
  UART_NOTIFY_CHAR,
  UART_SERVICE,
  UART_WRITE_CHAR,
} from '../protocol/constants';
import {
  TransportError,
  type CarConnection,
  type CarTransport,
  type ConnectionHandlers,
  type DeviceInfo,
  type ServiceDescription,
  type SupportResult,
} from './types';

const CONNECT_TIMEOUT_MS = 12000;

function mapError(e: unknown): TransportError {
  if (e instanceof TransportError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  // The plugin reports errors as plain messages; match the common ones, fall back to connect-failed.
  if (/cancel/i.test(msg)) return new TransportError('cancelled', msg);
  if (/permission|denied|not authori[sz]ed|unauthori[sz]ed/i.test(msg))
    return new TransportError('permission-denied', msg);
  if (/disabled|not enabled|powered off|turned off/i.test(msg))
    return new TransportError('bluetooth-off', msg);
  if (/not supported|unsupported/i.test(msg)) return new TransportError('unsupported', msg);
  if (/timeout|timed out/i.test(msg)) return new TransportError('timeout', msg);
  return new TransportError('connect-failed', msg);
}

/** Native BLE on Android and iOS through @capacitor-community/bluetooth-le. */
export class CapacitorBleTransport implements CarTransport {
  readonly kind = 'capacitor-ble' as const;
  private initialized: Promise<BleClientInterface> | null = null;

  /** Loads the plugin lazily so the web bundle does not carry it. */
  private init(): Promise<BleClientInterface> {
    this.initialized ??= import('@capacitor-community/bluetooth-le')
      .then(async ({ BleClient }) => {
        // androidNeverForLocation requires the matching manifest flag (android/app/src/main/AndroidManifest.xml).
        await BleClient.initialize({ androidNeverForLocation: true });
        return BleClient;
      })
      .catch((e: unknown) => {
        this.initialized = null;
        throw mapError(e);
      });
    return this.initialized;
  }

  async checkSupport(): Promise<SupportResult> {
    try {
      const BleClient = await this.init();
      const enabled = await BleClient.isEnabled();
      return enabled ? { ok: true } : { ok: false, reason: 'bluetooth-off' };
    } catch (e) {
      const err = mapError(e);
      if (err.code === 'bluetooth-off') return { ok: false, reason: 'bluetooth-off' };
      if (err.code === 'unsupported') return { ok: false, reason: 'unsupported' };
      // Permission problems surface when the user tries to pick a car.
      return { ok: true };
    }
  }

  async requestDevice(): Promise<DeviceInfo> {
    const BleClient = await this.init();
    try {
      const d = await BleClient.requestDevice({
        namePrefix: NAME_PREFIX,
        optionalServices: [UART_SERVICE],
      });
      return { id: d.deviceId, name: d.name ?? NAME_PREFIX };
    } catch (e) {
      throw mapError(e);
    }
  }

  async canReconnect(): Promise<boolean> {
    // Android uses the MAC address and iOS a per-app UUID; both stay valid across launches.
    return true;
  }

  async connect(deviceId: string, handlers: ConnectionHandlers): Promise<CarConnection> {
    const BleClient = await this.init();
    let closedByUs = false;
    try {
      await BleClient.connect(
        deviceId,
        () => {
          if (!closedByUs) handlers.onDisconnect();
        },
        { timeout: CONNECT_TIMEOUT_MS },
      );
      // The plugin enables INDICATION when the characteristic only supports indicate (verified in its Android source).
      await BleClient.startNotifications(
        deviceId,
        UART_SERVICE,
        UART_NOTIFY_CHAR,
        (value: DataView) => {
          handlers.onData(
            new Uint8Array(
              value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
            ),
          );
        },
      );
    } catch (e) {
      closedByUs = true;
      await BleClient.disconnect(deviceId).catch(() => undefined);
      throw mapError(e);
    }

    return {
      device: { id: deviceId, name: NAME_PREFIX },
      async write(data: Uint8Array) {
        try {
          await BleClient.writeWithoutResponse(
            deviceId,
            UART_SERVICE,
            UART_WRITE_CHAR,
            new DataView(data.slice().buffer),
          );
        } catch (e) {
          throw new TransportError('write-failed', e instanceof Error ? e.message : String(e));
        }
      },
      async disconnect() {
        closedByUs = true;
        await BleClient.stopNotifications(deviceId, UART_SERVICE, UART_NOTIFY_CHAR).catch(
          () => undefined,
        );
        await BleClient.disconnect(deviceId).catch(() => undefined);
      },
      async describe(): Promise<ServiceDescription[]> {
        const services = await BleClient.getServices(deviceId);
        return services.map((s) => ({
          uuid: s.uuid,
          characteristics: s.characteristics.map((c) => ({
            uuid: c.uuid,
            properties: Object.entries(c.properties)
              .filter(([, on]) => on)
              .map(([k]) => k),
          })),
        }));
      },
    };
  }
}
