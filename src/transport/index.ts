import { Capacitor } from '@capacitor/core';
import { CapacitorBleTransport } from './CapacitorBleTransport';
import { MockTransport } from './MockTransport';
import { WebBluetoothTransport } from './WebBluetoothTransport';
import type { CarTransport } from './types';

export * from './types';
export { MOCK_CARS } from './MockTransport';

let real: CarTransport | null = null;
let mock: MockTransport | null = null;

export function getMockTransport(): MockTransport {
  mock ??= new MockTransport();
  return mock;
}

/** Picks the transport for this platform. Mock mode wins when enabled in dev options. */
export function getTransport(useMock: boolean): CarTransport {
  if (useMock) return getMockTransport();
  real ??= Capacitor.isNativePlatform() ? new CapacitorBleTransport() : new WebBluetoothTransport();
  return real;
}
