import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SpeedMode } from '../protocol/commands';

export type ControlStyle = 'joystick' | 'pad';
export type Units = 'cm' | 'in';
export type GlassLevel = 'full' | 'subtle' | 'off';
export type MotionLevel = 'full' | 'calm';

export type QuickCommandId =
  | 'stop-all'
  | 'spin-left'
  | 'spin-right'
  | 'nudge-forward'
  | 'nudge-back'
  | 'mode-slow'
  | 'mode-normal'
  | 'mode-turbo'
  | 'honk'
  | 'locate'
  | 'lock';

export interface Settings {
  controlStyle: ControlStyle;
  units: Units;
  haptics: boolean;
  sound: boolean;
  shakeToStop: boolean;
  glass: GlassLevel;
  motion: MotionLevel;
  devOptions: boolean;
  mockMode: boolean;
  speedMode: SpeedMode;
  pinned: QuickCommandId[];
  keyboardHintSeen: boolean;
  /** One-time notice shown the first time "Stop when lifted" is turned off. */
  liftOffNoticeSeen: boolean;
}

interface SettingsState extends Settings {
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  togglePin(id: QuickCommandId): void;
}

export const DEFAULT_SETTINGS: Settings = {
  controlStyle: 'joystick',
  units: 'cm',
  haptics: true,
  sound: false,
  shakeToStop: true,
  glass: 'full',
  motion: 'full',
  devOptions: false,
  mockMode: false,
  speedMode: 'normal',
  pinned: ['spin-left', 'spin-right', 'nudge-forward', 'nudge-back'],
  keyboardHintSeen: false,
  liftOffNoticeSeen: false,
};

export const MAX_PINNED = 6;

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set(key, value) {
        set({ [key]: value } as Partial<SettingsState>);
      },
      togglePin(id) {
        set((s) => {
          if (s.pinned.includes(id)) return { pinned: s.pinned.filter((p) => p !== id) };
          if (s.pinned.length >= MAX_PINNED) return {};
          return { pinned: [...s.pinned, id] };
        });
      },
    }),
    {
      name: 'stembot.settings.v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const out: Partial<Settings> = {};
        for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
          (out as Record<string, unknown>)[k] = s[k];
        }
        return out;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        const out = { ...current };
        // Only accept known keys with the same type as the default.
        for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
          const v = p[k];
          if (v !== undefined && typeof v === typeof DEFAULT_SETTINGS[k]) {
            (out as Record<string, unknown>)[k] = v;
          }
        }
        if (!Array.isArray(out.pinned)) out.pinned = DEFAULT_SETTINGS.pinned;
        return out;
      },
    },
  ),
);
