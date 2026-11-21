import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { clampObstacle, clampSpeed } from '../protocol/commands';
import { SPEED_DEFAULT } from '../protocol/constants';

export const CAR_COLORS = [
  { id: 'cyan', label: 'Cyan', value: '#3EE6FF' },
  { id: 'caramel', label: 'Caramel', value: '#D9A877' },
  { id: 'lime', label: 'Lime', value: '#B6F24A' },
  { id: 'violet', label: 'Violet', value: '#A58BFF' },
  { id: 'coral', label: 'Coral', value: '#FF8A6B' },
  { id: 'cream', label: 'Cream', value: '#F4ECE1' },
] as const;

export type CarColorId = (typeof CAR_COLORS)[number]['id'];

export interface SavedCar {
  id: string;
  name: string;
  color: CarColorId;
  /** Base speed 200..1023 (cars differ in motor strength). */
  speed: number;
  /** Wheels wired the other way: swap forward/back and left/right in the app. */
  reversed: boolean;
  inGroup: boolean;
  deviceId: string;
  deviceName: string;
  /** Which transport found it, so mock cars never mix with real ones. */
  source: 'real' | 'mock';
  addedAt: number;
  lastDistanceCm: number | null;
  lastSeenAt: number | null;
  /** Timestamps of recent unexpected disconnects (for the power hint). */
  drops: number[];
  /** Firmware v2 `i1`/`i0`. Off by default: a lifted car keeps driving. */
  stopWhenLifted: boolean;
  /** Firmware v2 `o<cm>`; 0 = off. */
  obstacleCm: number;
  /** Last capability reply from the car (persisted so per-car options can be hidden offline). */
  caps: { version: string; hasUltrasonic: boolean; hasHorn: boolean } | null;
}

interface GarageState {
  cars: SavedCar[];
  lastDrivenId: string | null;
  addCar(input: Pick<SavedCar, 'name' | 'color' | 'deviceId' | 'deviceName' | 'source'>): SavedCar;
  updateCar(id: string, patch: Partial<Omit<SavedCar, 'id'>>): void;
  removeCar(id: string): void;
  recordDrop(id: string, at: number): void;
  setLastDriven(id: string): void;
}

const NAME_MAX = 24;

export function cleanName(name: string): string {
  // Strip control characters (U+0000..U+001F, U+007F) from user input.
  const printable = [...name].filter((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code > 0x1f && code !== 0x7f;
  });
  return printable.join('').trim().slice(0, NAME_MAX);
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `car-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nextFreeColor(cars: SavedCar[]): CarColorId {
  const used = new Set(cars.map((c) => c.color));
  return (
    CAR_COLORS.find((c) => !used.has(c.id)) ??
    CAR_COLORS[cars.length % CAR_COLORS.length] ??
    CAR_COLORS[0]
  ).id;
}

export function colorValue(id: CarColorId): string {
  return CAR_COLORS.find((c) => c.id === id)?.value ?? CAR_COLORS[0].value;
}

export const useGarage = create<GarageState>()(
  persist(
    (set, get) => ({
      cars: [],
      lastDrivenId: null,
      addCar(input) {
        const car: SavedCar = {
          id: newId(),
          name: cleanName(input.name) || `Car ${get().cars.length + 1}`,
          color: input.color,
          speed: SPEED_DEFAULT,
          reversed: false,
          inGroup: true,
          deviceId: input.deviceId,
          deviceName: input.deviceName,
          source: input.source,
          addedAt: Date.now(),
          lastDistanceCm: null,
          lastSeenAt: null,
          drops: [],
          stopWhenLifted: false,
          obstacleCm: 0,
          caps: null,
        };
        set((s) => ({ cars: [...s.cars, car] }));
        return car;
      },
      updateCar(id, patch) {
        set((s) => ({
          cars: s.cars.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...patch,
                  name: patch.name !== undefined ? cleanName(patch.name) || c.name : c.name,
                  speed: patch.speed !== undefined ? clampSpeed(patch.speed) : c.speed,
                  obstacleCm:
                    patch.obstacleCm !== undefined ? clampObstacle(patch.obstacleCm) : c.obstacleCm,
                }
              : c,
          ),
        }));
      },
      removeCar(id) {
        set((s) => ({
          cars: s.cars.filter((c) => c.id !== id),
          lastDrivenId: s.lastDrivenId === id ? null : s.lastDrivenId,
        }));
      },
      recordDrop(id, at) {
        set((s) => ({
          cars: s.cars.map((c) => (c.id === id ? { ...c, drops: [...c.drops, at].slice(-10) } : c)),
        }));
      },
      setLastDriven(id) {
        set({ lastDrivenId: id });
      },
    }),
    {
      name: 'stembot.garage.v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Validate what comes back from storage: it may be edited or corrupted.
      merge: (persisted, current) => {
        const p = persisted as Partial<GarageState> | undefined;
        const cars = Array.isArray(p?.cars) ? p.cars.filter(isSavedCar).map(withV2Defaults) : [];
        return {
          ...current,
          cars,
          lastDrivenId: typeof p?.lastDrivenId === 'string' ? p.lastDrivenId : null,
        };
      },
    },
  ),
);

/** Cars saved before firmware v2 support lack the new fields: fill safe defaults. */
function withV2Defaults(c: SavedCar): SavedCar {
  const raw = c as Partial<SavedCar>;
  const caps = raw.caps;
  return {
    ...c,
    stopWhenLifted: typeof raw.stopWhenLifted === 'boolean' ? raw.stopWhenLifted : false,
    obstacleCm: clampObstacle(typeof raw.obstacleCm === 'number' ? raw.obstacleCm : 0),
    caps:
      caps &&
      typeof caps === 'object' &&
      typeof caps.version === 'string' &&
      typeof caps.hasUltrasonic === 'boolean' &&
      typeof caps.hasHorn === 'boolean'
        ? caps
        : null,
  };
}

/** Obstacle stop needs a distance sensor; hide it only when the car says it has none. */
export function canUseObstacleStop(car: SavedCar): boolean {
  return car.caps?.hasUltrasonic !== false;
}

function isSavedCar(x: unknown): x is SavedCar {
  if (!x || typeof x !== 'object') return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.deviceId === 'string' &&
    typeof c.speed === 'number' &&
    typeof c.reversed === 'boolean' &&
    CAR_COLORS.some((k) => k.id === c.color) &&
    (c.source === 'real' || c.source === 'mock') &&
    Array.isArray(c.drops)
  );
}

/** "Check batteries" hint: 2+ unexpected drops in the last 15 minutes. A hint, not a measurement. */
export function powerHint(car: SavedCar, now: number): { level: 'ok' | 'check'; drops: number } {
  const recent = car.drops.filter((t) => now - t < 15 * 60_000).length;
  return { level: recent >= 2 ? 'check' : 'ok', drops: recent };
}
