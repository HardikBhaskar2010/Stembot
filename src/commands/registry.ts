import {
  ArrowDownToLine,
  ArrowUpToLine,
  Gauge,
  Lock,
  Megaphone,
  OctagonX,
  Rabbit,
  RotateCcw,
  RotateCw,
  ScanSearch,
  Turtle,
  type LucideIcon,
} from 'lucide-react';
import { honk, locate, pulse, setLocked, stopAll } from '../control/fleet';
import { t } from '../i18n/en';
import { useLive } from '../store/live';
import { useSettings, type QuickCommandId } from '../store/settings';

export interface QuickCommand {
  id: QuickCommandId;
  label: string;
  icon: LucideIcon;
  /** Keyboard hint shown in the palette. */
  keys?: string;
  tone?: 'stop' | 'default';
  /** Why it is unavailable for these cars, or null if it can run. */
  unavailable(targets: string[]): string | null;
  run(targets: string[]): void;
}

const needsHorn = (targets: string[]) => {
  const cars = useLive.getState().cars;
  return targets.some((id) => cars[id]?.capabilities?.hasHorn) ? null : t('commands.needsFirmware');
};
const needsCars = (targets: string[]) => (targets.length > 0 ? null : t('drive.noCar'));
const notLocked = (targets: string[]) =>
  useLive.getState().locked ? t('drive.lockedHint') : needsCars(targets);

export const COMMANDS: QuickCommand[] = [
  {
    id: 'stop-all',
    label: t('commands.stop-all'),
    icon: OctagonX,
    keys: 'Space',
    tone: 'stop',
    unavailable: () => null,
    run: () => stopAll('button'),
  },
  {
    id: 'spin-left',
    label: t('commands.spin-left'),
    icon: RotateCcw,
    unavailable: notLocked,
    run: (ids) => pulse(ids, 'left', 'spin'),
  },
  {
    id: 'spin-right',
    label: t('commands.spin-right'),
    icon: RotateCw,
    unavailable: notLocked,
    run: (ids) => pulse(ids, 'right', 'spin'),
  },
  {
    id: 'nudge-forward',
    label: t('commands.nudge-forward'),
    icon: ArrowUpToLine,
    unavailable: notLocked,
    run: (ids) => pulse(ids, 'forward', 'nudge'),
  },
  {
    id: 'nudge-back',
    label: t('commands.nudge-back'),
    icon: ArrowDownToLine,
    unavailable: notLocked,
    run: (ids) => pulse(ids, 'backward', 'nudge'),
  },
  {
    id: 'mode-slow',
    label: t('commands.mode-slow'),
    icon: Turtle,
    unavailable: () => null,
    run: () => useSettings.getState().set('speedMode', 'slow'),
  },
  {
    id: 'mode-normal',
    label: t('commands.mode-normal'),
    icon: Gauge,
    unavailable: () => null,
    run: () => useSettings.getState().set('speedMode', 'normal'),
  },
  {
    id: 'mode-turbo',
    label: t('commands.mode-turbo'),
    icon: Rabbit,
    unavailable: () => null,
    run: () => useSettings.getState().set('speedMode', 'turbo'),
  },
  {
    id: 'honk',
    label: t('commands.honk'),
    icon: Megaphone,
    keys: 'H',
    unavailable: needsHorn,
    run: (ids) => honk(ids),
  },
  {
    id: 'locate',
    label: t('commands.locate'),
    icon: ScanSearch,
    unavailable: needsHorn,
    run: (ids) => locate(ids),
  },
  {
    id: 'lock',
    label: t('commands.lock'),
    icon: Lock,
    keys: 'L',
    unavailable: () => null,
    run: () => setLocked(!useLive.getState().locked),
  },
];

export function commandById(id: QuickCommandId): QuickCommand | undefined {
  return COMMANDS.find((c) => c.id === id);
}
