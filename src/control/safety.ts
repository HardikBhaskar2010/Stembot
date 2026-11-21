import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useSettings } from '../store/settings';
import { stopAll } from './fleet';

/**
 * Global stop triggers. Every one of these sends `x` to every connected car:
 * tab hidden, window blur, page hide/unload, native app pause, and (optionally) a shake.
 * The car's own 250 ms watchdog and its disconnect handler are the second line of defence.
 */
export function installSafety(target: Window = window): () => void {
  const onVisibility = () => {
    if (target.document.visibilityState === 'hidden') stopAll('hidden');
  };
  const onBlur = () => stopAll('blur');
  const onPageHide = () => stopAll('pagehide');

  target.document.addEventListener('visibilitychange', onVisibility);
  target.addEventListener('blur', onBlur);
  target.addEventListener('pagehide', onPageHide);
  target.addEventListener('beforeunload', onPageHide);

  const cleanups: (() => void)[] = [];
  if (Capacitor.isNativePlatform()) {
    const handle = App.addListener('pause', () => stopAll('hidden'));
    cleanups.push(() => void handle.then((h) => h.remove()));
  }

  const shake = createShakeDetector(() => stopAll('shake'));
  target.addEventListener('devicemotion', shake);

  return () => {
    target.document.removeEventListener('visibilitychange', onVisibility);
    target.removeEventListener('blur', onBlur);
    target.removeEventListener('pagehide', onPageHide);
    target.removeEventListener('beforeunload', onPageHide);
    target.removeEventListener('devicemotion', shake);
    cleanups.forEach((c) => c());
  };
}

/** Two strong jolts within 600 ms. Tuned to ignore normal handling of the phone. */
export function createShakeDetector(
  onShake: () => void,
  now: () => number = () => performance.now(),
) {
  let lastJolt = 0;
  let lastFire = 0;
  return (e: DeviceMotionEvent) => {
    if (!useSettings.getState().shakeToStop) return;
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const g = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    if (Math.abs(g - 9.81) < 14) return;
    const t = now();
    if (t - lastJolt < 600 && t - lastFire > 1000) {
      lastFire = t;
      onShake();
    }
    lastJolt = t;
  };
}

/** iOS 13+ needs an explicit permission for motion events, requested from a tap. */
export async function requestMotionPermission(): Promise<boolean> {
  const DME = (globalThis as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } })
    .DeviceMotionEvent;
  if (!DME || typeof DME.requestPermission !== 'function') return true;
  try {
    return (await DME.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}
