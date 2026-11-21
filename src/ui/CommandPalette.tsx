import { Pin, PinOff, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { COMMANDS, type QuickCommand } from '../commands/registry';
import { t } from '../i18n/en';
import { haptic } from '../platform/feedback';
import { useSettings, MAX_PINNED } from '../store/settings';
import { useUi } from '../store/ui';
import { IconButton } from './primitives';
import { useModal } from './useModal';

export function CommandPalette({ targets }: { targets: string[] }) {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPalette);
  if (!open) return null;
  return <PaletteDialog targets={targets} onClose={() => setOpen(false)} />;
}

function PaletteDialog({ targets, onClose }: { targets: string[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const pinned = useSettings((s) => s.pinned);
  const togglePin = useSettings((s) => s.togglePin);
  const ref = useModal<HTMLDivElement>(onClose);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return COMMANDS.filter((c) => !needle || c.label.toLowerCase().includes(needle));
  }, [q]);

  const run = (c: QuickCommand) => {
    if (c.unavailable(targets)) return;
    haptic('press');
    c.run(targets);
    if (c.id !== 'lock') onClose();
  };

  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className="sheet glass palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-title"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
            if (e.key === 'Enter' && e.target === input.current) {
              const c = list.find((x) => !x.unavailable(targets));
              if (c) run(c);
            }
            return;
          }
          e.preventDefault();
          const runs = [
            ...e.currentTarget.querySelectorAll<HTMLButtonElement>('.palette__run:not(:disabled)'),
          ];
          const i = runs.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            e.key === 'ArrowDown' ? (runs[i + 1] ?? runs[0]) : i <= 0 ? input.current : runs[i - 1];
          next?.focus();
        }}
      >
        <div className="sheet__head">
          <h2 id="palette-title">{t('commands.title')}</h2>
          <IconButton label={t('common.close')} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>
        <label className="palette__search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">{t('commands.search')}</span>
          <input
            ref={input}
            className="palette__input"
            placeholder={t('commands.search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="sheet__body">
          {list.length === 0 && <p className="palette__empty">{t('commands.noResults', { q })}</p>}
          <ul aria-label={t('commands.all')} className="palette__list">
            {list.map((c) => {
              const why = c.unavailable(targets);
              const isPinned = pinned.includes(c.id);
              return (
                <li
                  key={c.id}
                  className={`palette__item ${c.tone === 'stop' ? 'palette__item--stop' : ''}`}
                >
                  <button
                    type="button"
                    className="palette__run"
                    onClick={() => run(c)}
                    aria-disabled={Boolean(why)}
                  >
                    <c.icon size={20} aria-hidden="true" />
                    <span className="palette__label">
                      {c.label}
                      {why && <span className="palette__why">{why}</span>}
                    </span>
                    {c.keys && <kbd className="palette__kbd">{c.keys}</kbd>}
                  </button>
                  {c.id !== 'stop-all' && (
                    <IconButton
                      label={
                        isPinned
                          ? t('commands.unpin', { name: c.label })
                          : t('commands.pin', { name: c.label })
                      }
                      aria-pressed={isPinned}
                      disabled={!isPinned && pinned.length >= MAX_PINNED}
                      onClick={() => togglePin(c.id)}
                      className={isPinned ? 'palette__pin--on' : ''}
                    >
                      {isPinned ? (
                        <PinOff size={18} aria-hidden="true" />
                      ) : (
                        <Pin size={18} aria-hidden="true" />
                      )}
                    </IconButton>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="palette__soon" aria-label={t('commands.soon')}>
            <span>{t('commands.soon')}:</span> {t('commands.followLeader')} ·{' '}
            {t('commands.formation')}
          </div>
        </div>
      </div>
    </div>
  );
}
