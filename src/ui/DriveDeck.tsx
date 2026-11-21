import { Command, Keyboard, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { commandById } from '../commands/registry';
import { hold, release } from '../control/fleet';
import { useDriveKeys } from '../control/useDriveKeys';
import { t } from '../i18n/en';
import { haptic } from '../platform/feedback';
import type { Direction, SpeedMode } from '../protocol/commands';
import { useLive } from '../store/live';
import { useSettings } from '../store/settings';
import { useUi } from '../store/ui';
import { ArrowPad, Joystick } from './DriveControls';
import { Button, IconButton, Segmented } from './primitives';
import { LockButton, StopAllButton } from './shared';
import { VoiceButton } from './VoiceButton';

/**
 * Shared control surface for Drive (one car) and Group (ticked cars).
 * Layout: left thumb = joystick/pad, right = speed + quick commands, giant STOP always visible.
 */
export function DriveDeck({
  targets,
  disabled,
  radar,
  mode = 'single',
}: {
  targets: string[];
  disabled?: boolean;
  radar: React.ReactNode;
  mode?: 'single' | 'group';
}) {
  const controlStyle = useSettings((s) => s.controlStyle);
  const speedMode = useSettings((s) => s.speedMode);
  const setSetting = useSettings((s) => s.set);
  const pinned = useSettings((s) => s.pinned);
  const locked = useLive((s) => s.locked);
  const openPalette = useUi((s) => s.setPalette);
  const [dir, setDir] = useState<Direction | null>(null);

  useDriveKeys(targets, setDir);

  // Speed changes apply immediately while a direction is held.
  useEffect(() => {
    if (dir) hold(targets, dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedMode]);

  const onHold = (d: Direction) => {
    setDir(d);
    hold(targets, d);
  };
  const onRelease = () => {
    setDir(null);
    release(targets);
  };

  const inputDisabled = disabled || locked;
  const Control = controlStyle === 'pad' ? ArrowPad : Joystick;

  return (
    <div className={`deck deck--${mode}`}>
      <div className="deck__radar">{radar}</div>

      <div className="deck__stop">
        <StopAllButton giant label={mode === 'group' ? t('common.stopAll') : t('common.stop')} />
      </div>

      <div className="deck__left">
        <Control onHold={onHold} onRelease={onRelease} disabled={inputDisabled} />
        <p className="deck__hint">{locked ? t('drive.lockedHint') : t('drive.holdHint')}</p>
      </div>

      <div className="deck__right">
        <Segmented<SpeedMode>
          label={t('drive.speed')}
          value={speedMode}
          tint={speedMode === 'turbo' ? 'glass--caramel' : 'glass--signal'}
          onChange={(v) => setSetting('speedMode', v)}
          options={[
            { value: 'slow', label: t('drive.slow') },
            { value: 'normal', label: t('drive.normal') },
            { value: 'turbo', label: t('drive.turbo') },
          ]}
        />
        <div className="quickbar glass" role="group" aria-label={t('commands.pinned')}>
          {pinned.map((id) => {
            const c = commandById(id);
            if (!c || c.id === 'lock' || c.id === 'stop-all') return null;
            const why = c.unavailable(targets);
            return (
              <button
                key={id}
                type="button"
                className="quickbar__btn glass-i"
                aria-disabled={Boolean(why)}
                title={why ?? c.label}
                onClick={() => {
                  if (why) return;
                  haptic('press');
                  c.run(targets);
                }}
              >
                <c.icon size={22} aria-hidden="true" />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
        <div className="deck__tools">
          <LockButton />
          <Button
            variant="glass"
            onClick={() => openPalette(true)}
            icon={<Command size={18} aria-hidden="true" />}
          >
            {t('common.commands')}
          </Button>
        </div>
        <VoiceButton targets={targets} />
      </div>
      <KeyboardHint />
    </div>
  );
}

function KeyboardHint() {
  const seen = useSettings((s) => s.keyboardHintSeen);
  const set = useSettings((s) => s.set);
  const [fine] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches,
  );
  if (seen || !fine) return null;
  return (
    <aside className="kbd-hint glass" aria-labelledby="kbd-hint-title">
      <Keyboard size={22} aria-hidden="true" className="kbd-hint__icon" />
      <div>
        <h2 id="kbd-hint-title">{t('drive.keyboardTitle')}</h2>
        <p>{t('drive.keyboardBody')}</p>
      </div>
      <IconButton label={t('drive.gotIt')} onClick={() => set('keyboardHintSeen', true)}>
        <X size={18} aria-hidden="true" />
      </IconButton>
    </aside>
  );
}
