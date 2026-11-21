import { create } from 'zustand';

export type Tone = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
  action?: { label: string; run: () => void };
  /** Playing its exit transition; removed after LEAVE_MS. */
  leaving?: boolean;
}

const LEAVE_MS = 200;

interface NotifyState {
  toasts: Toast[];
  polite: string;
  assertive: string;
  toast(t: Omit<Toast, 'id'>, ttlMs?: number): void;
  dismiss(id: number): void;
  announce(text: string, assertive?: boolean): void;
}

let nextId = 1;

export const useNotify = create<NotifyState>()((set, get) => ({
  toasts: [],
  polite: '',
  assertive: '',
  toast(t, ttlMs = 5000) {
    const id = nextId++;
    // Replace a toast with the same title (e.g. repeated "lost connection") instead of stacking.
    set((s) => ({
      toasts: [...s.toasts.filter((x) => x.title !== t.title), { ...t, id }].slice(-3),
    }));
    if (ttlMs > 0) setTimeout(() => get().dismiss(id), ttlMs);
  },
  dismiss(id) {
    const target = get().toasts.find((t) => t.id === id);
    if (!target || target.leaving) return;
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), LEAVE_MS);
  },
  announce(text, assertive = false) {
    // Clear first so the same message is announced again.
    if (assertive) {
      set({ assertive: '' });
      setTimeout(() => set({ assertive: text }), 30);
    } else {
      set({ polite: '' });
      setTimeout(() => set({ polite: text }), 30);
    }
  },
}));
