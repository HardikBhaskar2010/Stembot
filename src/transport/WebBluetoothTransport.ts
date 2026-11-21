import {
  NAME_PREFIX,
  UART_NOTIFY_CHAR,
  UART_SERVICE,
  UART_WRITE_CHAR,
} from '../protocol/constants';
import {
  TransportError,
  withTimeout,
  type CarConnection,
  type CarTransport,
  type ConnectionHandlers,
  type DeviceInfo,
  type ServiceDescription,
  type SupportResult,
} from './types';

const CONNECT_TIMEOUT_MS = 12000;

function propsOf(p: BluetoothCharacteristicProperties): string[] {
  const out: string[] = [];
  if (p.read) out.push('read');
  if (p.write) out.push('write');
  if (p.writeWithoutResponse) out.push('writeWithoutResponse');
  if (p.notify) out.push('notify');
  if (p.indicate) out.push('indicate');
  return out;
}

function mapError(e: unknown): TransportError {
  if (e instanceof TransportError) return e;
  const name = e instanceof DOMException ? e.name : '';
  const msg = e instanceof Error ? e.message : String(e);
  if (name === 'NotFoundError' && /cancel/i.test(msg)) return new TransportError('cancelled', msg);
  if (name === 'NotFoundError' && /adapter|bluetooth.*(off|unavailable|not available)/i.test(msg))
    return new TransportError('bluetooth-off', msg);
  if (name === 'NotFoundError') return new TransportError('not-found', msg);
  if (name === 'SecurityError' || name === 'NotAllowedError')
    return new TransportError('permission-denied', msg);
  if (name === 'NotSupportedError') return new TransportError('unsupported', msg);
  return new TransportError('connect-failed', msg);
}

/** Chrome / Edge on desktop and Android. Not available in Safari or Firefox. */
export class WebBluetoothTransport implements CarTransport {
  readonly kind = 'web-bluetooth' as const;
  /** Devices picked in this page session. Survives disconnects, not reloads. */
  private readonly devices = new Map<string, BluetoothDevice>();

  async checkSupport(): Promise<SupportResult> {
    if (!window.isSecureContext) return { ok: false, reason: 'insecure' };
    if (!('bluetooth' in navigator) || !navigator.bluetooth)
      return { ok: false, reason: 'unsupported' };
    try {
      const available = await navigator.bluetooth.getAvailability();
      if (!available) return { ok: false, reason: 'bluetooth-off' };
    } catch {
      // getAvailability missing or failing is not proof Bluetooth is off; let requestDevice decide.
    }
    return { ok: true };
  }

  async requestDevice(): Promise<DeviceInfo> {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: NAME_PREFIX }],
        optionalServices: [UART_SERVICE],
      });
      this.devices.set(device.id, device);
      return { id: device.id, name: device.name ?? NAME_PREFIX };
    } catch (e) {
      throw mapError(e);
    }
  }

  async canReconnect(deviceId: string): Promise<boolean> {
    if (this.devices.has(deviceId)) return true;
    // getDevices() is not enabled by default in every Chrome build; use it only if present.
    const bt = navigator.bluetooth as Bluetooth & { getDevices?: () => Promise<BluetoothDevice[]> };
    if (typeof bt.getDevices !== 'function') return false;
    try {
      const known = await bt.getDevices();
      const match = known.find((d) => d.id === deviceId);
      if (match) this.devices.set(match.id, match);
      return Boolean(match);
    } catch {
      return false;
    }
  }

  async connect(deviceId: string, handlers: ConnectionHandlers): Promise<CarConnection> {
    if (!(await this.canReconnect(deviceId))) throw new TransportError('needs-picker');
    const device = this.devices.get(deviceId);
    if (!device?.gatt) throw new TransportError('needs-picker');

    let closedByUs = false;
    const onGattDisconnected = () => {
      device.removeEventListener('gattserverdisconnected', onGattDisconnected);
      if (!closedByUs) handlers.onDisconnect();
    };

    try {
      const server = await withTimeout(device.gatt.connect(), CONNECT_TIMEOUT_MS);
      device.addEventListener('gattserverdisconnected', onGattDisconnected);
      const service = await server.getPrimaryService(UART_SERVICE);
      const writeChar = await service.getCharacteristic(UART_WRITE_CHAR);
      const notifyChar = await service.getCharacteristic(UART_NOTIFY_CHAR);
      const onValue = (ev: Event) => {
        const target = ev.target as BluetoothRemoteGATTCharacteristic;
        const v = target.value;
        if (v)
          handlers.onData(
            new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)),
          );
      };
      notifyChar.addEventListener('characteristicvaluechanged', onValue);
      await notifyChar.startNotifications(); // handles indicate as well as notify
      const noResponse = writeChar.properties.writeWithoutResponse;

      return {
        device: { id: device.id, name: device.name ?? NAME_PREFIX },
        async write(data: Uint8Array) {
          const buf = data.slice().buffer;
          try {
            if (noResponse) await writeChar.writeValueWithoutResponse(buf);
            else await writeChar.writeValueWithResponse(buf);
          } catch (e) {
            throw new TransportError('write-failed', e instanceof Error ? e.message : String(e));
          }
        },
        async disconnect() {
          closedByUs = true;
          notifyChar.removeEventListener('characteristicvaluechanged', onValue);
          try {
            await notifyChar.stopNotifications();
          } catch {
            /* already gone */
          }
          device.gatt?.disconnect();
        },
        async describe(): Promise<ServiceDescription[]> {
          const services = await server.getPrimaryServices();
          return Promise.all(
            services.map(async (s) => ({
              uuid: s.uuid,
              characteristics: (await s.getCharacteristics()).map((c) => ({
                uuid: c.uuid,
                properties: propsOf(c.properties),
              })),
            })),
          );
        },
      };
    } catch (e) {
      closedByUs = true;
      device.gatt.disconnect();
      throw mapError(e);
    }
  }
}
