import { TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { installSafety } from '../control/safety';
import { t } from '../i18n/en';
import { AddCar } from '../screens/AddCar';
import { Dev } from '../screens/Dev';
import { Drive } from '../screens/Drive';
import { Garage } from '../screens/Garage';
import { Group } from '../screens/Group';
import { Settings } from '../screens/Settings';
import { useDevLog } from '../store/devlog';
import { useLive } from '../store/live';
import { useSettings } from '../store/settings';
import { useUi } from '../store/ui';
import { CarEditor } from '../ui/CarEditor';
import { CommandPalette } from '../ui/CommandPalette';
import { LiveRegions, Toasts } from '../ui/shared';
import { hrefFor, useRoute } from './router';

export function App() {
  const route = useRoute();
  const glass = useSettings((s) => s.glass);
  const motion = useSettings((s) => s.motion);
  const dev = useSettings((s) => s.devOptions);
  const targets = useUi((s) => s.targets);
  const live = useLive((s) => s.cars);
  const setPalette = useUi((s) => s.setPalette);

  const paletteTargets = useMemo(
    () =>
      targets ??
      Object.entries(live)
        .filter(([, l]) => l.status === 'connected')
        .map(([id]) => id),
    [targets, live],
  );

  useEffect(() => installSafety(), []);

  useEffect(() => {
    useDevLog.getState().setEnabled(dev);
  }, [dev]);

  useEffect(() => {
    document.documentElement.dataset.glass = glass;
    document.documentElement.dataset.motion = motion;
  }, [glass, motion]);

  // Command palette: Ctrl/Cmd + K anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette]);

  // Interactive glass: one delegated listener moves the highlight under the pointer.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.glass-i') as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, []);

  // Screen change: move focus to the new heading so screen readers announce where we are.
  const routeKey = location.hash;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const h = document.querySelector<HTMLElement>('main h1');
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }, [routeKey]);

  // Never leave a dev-only route reachable when dev options are off.
  const effective = route.name === 'dev' && !dev ? { name: 'settings' as const } : route;

  return (
    <>
      <div className="ambient" aria-hidden="true" />
      {dev && (
        <div className="dev-banner" role="note">
          <TriangleAlert size={16} aria-hidden="true" />
          {t('app.devBanner')}
          {effective.name !== 'dev' && (
            <a href={hrefFor({ name: 'dev' })} className="dev-banner__link">
              {t('settings.openDev')}
            </a>
          )}
        </div>
      )}
      {effective.name === 'garage' && <Garage />}
      {effective.name === 'add' && <AddCar />}
      {effective.name === 'drive' && <Drive key={effective.carId} carId={effective.carId} />}
      {effective.name === 'group' && <Group />}
      {effective.name === 'settings' && <Settings />}
      {effective.name === 'dev' && <Dev />}
      <CommandPalette targets={paletteTargets} />
      <CarEditor />
      <Toasts />
      <LiveRegions />
    </>
  );
}
