import { create } from 'zustand';

interface UiState {
  /** Cars the current screen drives (Drive: one car, Group: ticked cars, elsewhere: all connected). */
  targets: string[] | null;
  paletteOpen: boolean;
  editingCarId: string | null;
  setTargets(ids: string[] | null): void;
  setPalette(open: boolean): void;
  editCar(id: string | null): void;
}

export const useUi = create<UiState>()((set) => ({
  targets: null,
  paletteOpen: false,
  editingCarId: null,
  setTargets(ids) {
    set({ targets: ids });
  },
  setPalette(open) {
    set({ paletteOpen: open });
  },
  editCar(id) {
    set({ editingCarId: id });
  },
}));
