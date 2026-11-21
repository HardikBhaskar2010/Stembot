import { create } from 'zustand';

export interface LogEntry {
  /** wall clock ms */
  t: number;
  carId: string;
  dir: 'tx' | 'rx' | 'sys' | 'err' | 'drop';
  text: string;
  /** parsed telemetry as JSON (rx only) */
  json?: string;
  ms?: number;
}

const MAX = 600;

interface DevLogState {
  entries: LogEntry[];
  /** Only collect when dev options are on, so normal use pays nothing. */
  enabled: boolean;
  add(e: LogEntry): void;
  clear(): void;
  setEnabled(on: boolean): void;
}

export const useDevLog = create<DevLogState>()((set, get) => ({
  entries: [],
  enabled: false,
  add(e) {
    if (!get().enabled) return;
    set((s) => {
      const next = s.entries.length >= MAX ? s.entries.slice(-MAX + 1) : s.entries.slice();
      next.push(e);
      return { entries: next };
    });
  },
  clear() {
    set({ entries: [] });
  },
  setEnabled(on) {
    set({ enabled: on, entries: on ? get().entries : [] });
  },
}));

export function exportLog(entries: LogEntry[], carNames: Record<string, string>): string {
  const header = 'time_iso\tcar\tdirection\ttext\tparsed\twrite_ms';
  const rows = entries.map((e) =>
    [
      new Date(e.t).toISOString(),
      carNames[e.carId] ?? e.carId,
      e.dir,
      JSON.stringify(e.text),
      e.json ?? '',
      e.ms !== undefined ? e.ms.toFixed(1) : '',
    ].join('\t'),
  );
  return [header, ...rows].join('\n');
}
