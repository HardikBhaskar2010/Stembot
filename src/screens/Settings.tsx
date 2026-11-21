import { ArrowLeft, ChevronRight } from 'lucide-react';
import { goBack, navigate } from '../app/router';
import { disconnectSource } from '../control/fleet';
import { requestMotionPermission } from '../control/safety';
import { t } from '../i18n/en';
import { useDevLog } from '../store/devlog';
import { useNotify } from '../store/notify';
import {
  useSettings,
  type ControlStyle,
  type GlassLevel,
  type MotionLevel,
  type Units,
} from '../store/settings';
import { Button, IconButton, Row, Segmented, Switch } from '../ui/primitives';

export function Settings() {
  const s = useSettings();
  const toast = useNotify((n) => n.toast);

  return (
    <main className="screen settings">
      <header className="topbar">
        <IconButton label={t('common.back')} onClick={goBack}>
          <ArrowLeft size={22} aria-hidden="true" />
        </IconButton>
        <h1 className="topbar__title">{t('settings.title')}</h1>
      </header>

      <div className="settings__body">
        <h2 className="section-title">{t('settings.controls')}</h2>
        <div className="settings__group">
          <div className="settings__field">
            <span className="row__label" id="set-style">
              {t('settings.controlStyle')}
            </span>
            <Segmented<ControlStyle>
              label={t('settings.controlStyle')}
              value={s.controlStyle}
              onChange={(v) => s.set('controlStyle', v)}
              options={[
                { value: 'joystick', label: t('settings.joystick') },
                { value: 'pad', label: t('settings.pad') },
              ]}
            />
          </div>
          <div className="settings__field">
            <span className="row__label">{t('settings.units')}</span>
            <Segmented<Units>
              label={t('settings.units')}
              value={s.units}
              onChange={(v) => s.set('units', v)}
              options={[
                { value: 'cm', label: t('settings.cm') },
                { value: 'in', label: t('settings.in') },
              ]}
            />
          </div>
        </div>

        <h2 className="section-title">{t('settings.feedback')}</h2>
        <div className="rows glass">
          <Row
            label={t('settings.haptics')}
            control={
              <Switch
                label={t('settings.haptics')}
                checked={s.haptics}
                onChange={(v) => s.set('haptics', v)}
              />
            }
          />
          <Row
            label={t('settings.sound')}
            control={
              <Switch
                label={t('settings.sound')}
                checked={s.sound}
                onChange={(v) => s.set('sound', v)}
              />
            }
          />
          <Row
            label={t('settings.shake')}
            control={
              <Switch
                label={t('settings.shake')}
                checked={s.shakeToStop}
                onChange={async (v) => {
                  if (v && !(await requestMotionPermission())) {
                    toast({ tone: 'warning', title: t('settings.shakeDenied') });
                    s.set('shakeToStop', false);
                    return;
                  }
                  s.set('shakeToStop', v);
                }}
              />
            }
          />
        </div>

        <h2 className="section-title">{t('settings.look')}</h2>
        <div className="settings__group">
          <div className="settings__field">
            <span className="row__label">{t('settings.glass')}</span>
            <Segmented<GlassLevel>
              label={t('settings.glass')}
              value={s.glass}
              onChange={(v) => s.set('glass', v)}
              options={[
                { value: 'full', label: t('settings.glassFull') },
                { value: 'subtle', label: t('settings.glassSubtle') },
                { value: 'off', label: t('settings.glassOff') },
              ]}
            />
          </div>
          <div className="settings__field">
            <span className="row__label">{t('settings.motion')}</span>
            <Segmented<MotionLevel>
              label={t('settings.motion')}
              value={s.motion}
              onChange={(v) => s.set('motion', v)}
              options={[
                { value: 'full', label: t('settings.motionFull') },
                { value: 'calm', label: t('settings.motionCalm') },
              ]}
            />
          </div>
        </div>
        <div className="rows glass">
          <Row
            label={t('settings.language')}
            control={<span className="row__value">{t('settings.languageValue')}</span>}
          />
        </div>

        <h2 className="section-title">{t('settings.advanced')}</h2>
        <div className="rows glass">
          <Row
            label={t('settings.dev')}
            hint={t('settings.devBody')}
            control={
              <Switch
                label={t('settings.dev')}
                checked={s.devOptions}
                onChange={(v) => {
                  s.set('devOptions', v);
                  useDevLog.getState().setEnabled(v);
                  if (!v && s.mockMode) {
                    s.set('mockMode', false);
                    void disconnectSource('mock');
                  }
                }}
              />
            }
          />
        </div>
        {s.devOptions && (
          <Button
            variant="glass"
            block
            className="settings__dev"
            onClick={() => navigate({ name: 'dev' })}
          >
            {t('settings.openDev')}
            <ChevronRight size={18} aria-hidden="true" />
          </Button>
        )}

        <p className="settings__about">{t('settings.about')}</p>
      </div>
    </main>
  );
}
