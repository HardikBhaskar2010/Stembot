import { create } from 'zustand';
import type { LinkStats } from '../control/CarLink';
import type { Capabilities, Telemetry } from '../protocol/telemetry';
import type { TransportErrorCode } from '../transport/types';

export type CarStatus = 'offline' | 'connecting' | 'connected' | 'lost' | 'failed';

export interface LiveCar {
  status: CarStatus;
  error: TransportErrorCode | null;
  telemetry: Telemetry | null;
  telemetryAt: number | null;
  /** Telemetry lines in the last few seconds, for link quality. */
  rxTimes: number[];
  capabilities: Capabilities | null;
  stats: LinkStats | null;
  driving: boolean;
}

export const EMPTY_LIVE: LiveCar = {
  status: 'offline',
  error: null,
  telemetry: null,
  telemetryAt: null,
  rxTimes: [],
  capabilities: null,
  stats: null,
  driving: false,
};

interface LiveState {
  cars: Record<string, LiveCar>;
  locked: boolean;
  patch(carId: string, patch: Partial<LiveCar>): void;
  reset(carId: string): void;
  setLocked(locked: boolean): void;
}

export const useLive = create<LiveState>()((set) => ({
  cars: {},
  locked: false,
  patch(carId, patch) {
    set((s) => ({ cars: { ...s.cars, [carId]: { ...(s.cars[carId] ?? EMPTY_LIVE), ...patch } } }));
  },
  reset(carId) {
    set((s) => ({
      cars: Object.fromEntries(Object.entries(s.cars).filter(([id]) => id !== carId)),
    }));
  },
  setLocked(locked) {
    set({ locked });
  },
}));

export function liveOf(state: { cars: Record<string, LiveCar> }, carId: string): LiveCar {
  return state.cars[carId] ?? EMPTY_LIVE;
}

/** 0..3 bars from the telemetry rate (expected ~6.7 lines/s) and write failures. null = unknown. */
export function linkQuality(live: LiveCar, now: number): number | null {
  if (live.status !== 'connected') return null;
  const recent = live.rxTimes.filter((t) => now - t < 3000).length;
  if (live.rxTimes.length === 0) return null;
  const rate = recent / 3;
  let bars = rate >= 5 ? 3 : rate >= 3 ? 2 : rate >= 1 ? 1 : 0;
  if (
    live.stats &&
    live.stats.sent > 20 &&
    (live.stats.failed + live.stats.timedOut) / live.stats.sent > 0.1
  ) {
    bars = Math.min(bars, 1);
  }
  return bars;
}
