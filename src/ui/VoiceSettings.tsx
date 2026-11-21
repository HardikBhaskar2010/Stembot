import { Download } from 'lucide-react';
import { useState } from 'react';
import { t } from '../i18n/en';
import { useNotify } from '../store/notify';
import { useSettings } from '../store/settings';
import { installVoice, voiceAvailability, type VoiceAvailability } from '../voice/engine';
import { Button, Row, Switch } from './primitives';
import { resetVoiceAvailability } from './VoiceButton';

/**
 * Settings → Voice commands (on-device only).
 * The device check runs only when the user turns the switch on: in some Chromium builds the
 * browser's own availability check crashes the page (seen in headless Chromium, Nov 2026),
 * so it must never run by itself, and never on the Drive screen unless voice is already on.
 */
export function VoiceSettings() {
  const voice = useSettings((s) => s.voice);
  const set = useSettings((s) => s.set);
  const toast = useNotify((s) => s.toast);
  const [checked, setChecked] = useState<VoiceAvailability | null>(null);
  const [busy, setBusy] = useState(false);

  const turnOn = async () => {
    setBusy(true);
    resetVoiceAvailability();
    const a = await voiceAvailability();
    setChecked(a);
    setBusy(false);
    if (a === 'available') set('voice', true);
    else if (a === 'unavailable') toast({ tone: 'warning', title: t('voice.unavailable') });
  };

  const hint =
    checked === 'unavailable'
      ? t('voice.unavailable')
      : voice
        ? `${t('voice.hint')} ${t('voice.privacy')}`
        : t('voice.offHint');

  return (
    <div className="rows glass">
      <Row
        label={t('voice.title')}
        hint={hint}
        control={
          <Switch
            label={t('voice.title')}
            checked={voice}
            disabled={busy}
            onChange={(v) => {
              if (v) void turnOn();
              else set('voice', false);
            }}
          />
        }
      />
      {(checked === 'downloadable' || checked === 'downloading' || busy) && (
        <div className="row">
          <div className="row__text">
            <div className="row__hint">{busy ? t('voice.checking') : t('voice.privacy')}</div>
          </div>
          {!busy && (
            <Button
              variant="glass"
              disabled={checked === 'downloading'}
              icon={<Download size={18} aria-hidden="true" />}
              onClick={() => {
                setChecked('downloading');
                void installVoice().then(() => void turnOn());
              }}
            >
              {checked === 'downloading' ? t('voice.downloading') : t('voice.download')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
