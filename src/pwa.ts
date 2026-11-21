import { Capacitor } from '@capacitor/core';

/** Offline support for the web build. Skipped inside the native apps, which ship their files. */
export function registerServiceWorker(): void {
  if (Capacitor.isNativePlatform() || !('serviceWorker' in navigator) || import.meta.env.DEV)
    return;
  window.addEventListener('load', () => {
    import('virtual:pwa-register')
      .then(({ registerSW }) => registerSW({ immediate: true }))
      .catch(() => undefined);
  });
}
