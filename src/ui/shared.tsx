import { Lock, LockOpen, OctagonX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { setLocked, stopAll } from '../control/fleet';
import { t } from '../i18n/en';
import { haptic } from '../platform/feedback';
import { useLive, type CarStatus } from '../store/live';
import { useNotify } from '../store/notify';
import { IconButton } from './primitives';

export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function StopAllButton({ giant = false, label }: { giant?: boolean; label?: string }) {
  return (
    <button
      type="button"
      className={`stop ${giant ? 'stop--giant' : ''}`}
      onPointerDown={() => stopAll('button')}
      onClick={(e) => {
        // pointerdown already stopped (fastest path); keyboard activation lands here.
        if (e.detail === 0) stopAll('button');
      }}
      aria-label={label ?? t('common.stopAll')}
      data-testid={giant ? 'stop-giant' : 'stop-all'}
    >
      <OctagonX size={giant ? 30 : 20} strokeWidth={2.5} aria-hidden="true" />
      <span>{giant ? t('common.stop') : t('common.stopAll')}</span>
    </button>
  );
}

export function StatusChip({ status, lifted }: { status: CarStatus; lifted?: boolean }) {
  const prev = useRef(status);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== 'connected' && status === 'connected') {
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 650);
      prev.current = status;
      return () => clearTimeout(id);
    }
    prev.current = status;
    return undefined;
  }, [status]);
  const kind = lifted && status === 'connected' ? 'lifted' : status;
  return (
    <span className={`chip chip--${kind} ${flash ? 'chip--just-connected' : ''}`}>
      <span className="chip__dot" aria-hidden="true" />
      {kind === 'lifted' ? t('status.lifted') : t(`status.${status}`)}
    </span>
  );
}

/** Lock never blocks STOP. Unlocking needs a 600 ms press so a stray tap can't do it. */
export function LockButton() {
  const locked = useLive((s) => s.locked);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancel = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };

  useEffect(() => cancel, []);

  if (!locked) {
    return (
      <button
        type="button"
        className="btn glass glass-i lock-btn"
        onClick={() => {
          haptic('press');
          setLocked(true);
        }}
      >
        <Lock size={18} aria-hidden="true" />
        {t('commands.lock')}
      </button>
    );
  }

  const start = () => {
    cancel();
    const t0 = performance.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / 600);
      setProgress(p);
      if (p >= 1) {
        cancel();
        haptic('press');
        setLocked(false);
      }
    }, 30);
  };

  return (
    <button
      type="button"
      className="btn glass glass--caramel glass-i lock-btn lock-btn--locked"
      style={{ ['--p' as string]: progress }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.repeat) start();
      }}
      onKeyUp={cancel}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={t('commands.unlock')}
    >
      <LockOpen size={18} aria-hidden="true" />
      {t('commands.unlock')}
      <span className="lock-btn__progress" aria-hidden="true" />
    </button>
  );
}

export function Toasts() {
  const toasts = useNotify((s) => s.toasts);
  const dismiss = useNotify((s) => s.dismiss);
  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast glass toast--${toast.tone}`}>
          <div className="toast__text">
            <div className="toast__title">{toast.title}</div>
            {toast.body && <div className="toast__body">{toast.body}</div>}
          </div>
          {toast.action && (
            <button
              type="button"
              className="btn glass glass--signal glass-i"
              onClick={() => {
                toast.action?.run();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <IconButton label={t('common.close')} onClick={() => dismiss(toast.id)}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

export function LiveRegions() {
  const polite = useNotify((s) => s.polite);
  const assertive = useNotify((s) => s.assertive);
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </>
  );
}
