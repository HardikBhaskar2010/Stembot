import { useEffect, useRef } from 'react';
import type { Direction } from '../protocol/commands';
import { SPEED_STEP } from '../protocol/constants';
import { useGarage } from '../store/garage';
import { hold, release, stopAll } from './fleet';

const KEYMAP: Record<string, Direction> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** Arrow keys belong to these widgets while they have focus (WASD still drives). */
function ownsArrows(el: EventTarget | null): boolean {
  return (
    el instanceof Element &&
    Boolean(el.closest('[role="radiogroup"], [role="tablist"], [role="listbox"]'))
  );
}

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable ||
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT'
  );
}

/**
 * Desktop driving: WASD / arrows hold, Q/E change speed by 100, Space stops everything.
 * The most recently pressed key wins; releasing it falls back to any key still held, else stop.
 */
export function useDriveKeys(targets: string[], onDirection?: (dir: Direction | null) => void) {
  const held = useRef<string[]>([]);
  const targetsRef = useRef(targets);
  const cbRef = useRef(onDirection);
  useEffect(() => {
    targetsRef.current = targets;
    cbRef.current = onDirection;
  });

  useEffect(() => {
    const apply = () => {
      const top = held.current.at(-1);
      const dir = top ? KEYMAP[top] : undefined;
      if (dir) hold(targetsRef.current, dir);
      else release(targetsRef.current);
      cbRef.current?.(dir ?? null);
    };

    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space') {
        // Space always stops on drive screens, even when a button has focus.
        e.preventDefault();
        held.current = [];
        stopAll('key');
        cbRef.current?.(null);
        return;
      }
      if (isTyping(e.target)) return;
      if (e.code in KEYMAP) {
        if (e.code.startsWith('Arrow') && ownsArrows(e.target)) return;
        e.preventDefault();
        if (e.repeat) return;
        held.current = [...held.current.filter((k) => k !== e.code), e.code];
        apply();
        return;
      }
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        if (e.repeat) return;
        const delta = e.code === 'KeyQ' ? -SPEED_STEP : SPEED_STEP;
        const g = useGarage.getState();
        for (const id of targetsRef.current) {
          const c = g.cars.find((x) => x.id === id);
          if (c) g.updateCar(id, { speed: c.speed + delta });
        }
        if (held.current.length) apply();
      }
    };

    const onUp = (e: KeyboardEvent) => {
      if (!(e.code in KEYMAP)) return;
      held.current = held.current.filter((k) => k !== e.code);
      apply();
    };

    const onBlur = () => {
      if (held.current.length) {
        held.current = [];
        release(targetsRef.current);
        cbRef.current?.(null);
      }
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      if (held.current.length) release(targetsRef.current);
      held.current = [];
    };
  }, []);
}
