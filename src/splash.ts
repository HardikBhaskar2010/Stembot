import { useSettings } from './store/settings';

/** The opening needs this long (from its first frame) to draw its arcs and set the wordmark. */
const OPENING_MS = 1250;
const CALM_MS = 300;
const EXIT_MS = 420;

/** When the opening started, on the document timeline (falls back to "now"). */
function openingStart(el: HTMLElement): number {
  const now = Number(document.timeline.currentTime ?? performance.now());
  const anim = el.querySelector('.splash__mark')?.getAnimations()[0];
  const start = anim?.startTime;
  return typeof start === 'number' ? start : now;
}

/**
 * Fade out the opening animation (markup in index.html, styles in src/styles/splash.css).
 * Called once the app has rendered. It waits only for the opening to finish (timed from the
 * opening's own first frame), and with Calm motion (Settings or OS reduced motion) it leaves
 * almost at once.
 */
export function dismissSplash(): void {
  const el = document.getElementById('splash');
  if (!el) return;
  const calm =
    useSettings.getState().motion === 'calm' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = Number(document.timeline.currentTime ?? performance.now());
  const wait = Math.max(0, openingStart(el) + (calm ? CALM_MS : OPENING_MS) - now);
  setTimeout(() => {
    el.classList.add('splash--out');
    setTimeout(() => el.remove(), EXIT_MS);
  }, wait);
}
