import { BatteryWarning, Pencil, Play, Power, RotateCw } from 'lucide-react';
import { navigate } from '../app/router';
import { connectCar, disconnectCar } from '../control/fleet';
import { t } from '../i18n/en';
import { colorValue, powerHint, type SavedCar } from '../store/garage';
import { linkQuality, liveOf, useLive } from '../store/live';
import { useSettings } from '../store/settings';
import { useUi } from '../store/ui';
import { Bars, Button, IconButton } from './primitives';
import { formatDistance, MiniEcho } from './Radar';
import { LiftStopSwitch } from './CarOptions';
import { StatusChip, useNow } from './shared';

export function CarCard({ car, enterDelay }: { car: SavedCar; enterDelay?: string }) {
  const live = useLive((s) => liveOf(s, car.id));
  const units = useSettings((s) => s.units);
  const editCar = useUi((s) => s.editCar);
  const now = useNow(1000);
  const lifted = live.telemetry?.lifted ?? false;
  const cm = live.telemetry ? live.telemetry.distanceCm : car.lastDistanceCm;
  const d = cm !== null ? formatDistance(cm, units) : null;
  const power = powerHint(car, now);
  const q = linkQuality(live, now);
  const connected = live.status === 'connected';

  return (
    <article
      className="car-card glass"
      style={{
        ['--tag' as string]: colorValue(car.color),
        ['--enter-delay' as string]: enterDelay,
      }}
      aria-label={car.name}
    >
      <header className="car-card__head">
        <span className="tag" aria-hidden="true" />
        <h2 className="car-card__name">{car.name}</h2>
        <IconButton label={t('garage.editCar', { name: car.name })} onClick={() => editCar(car.id)}>
          <Pencil size={18} aria-hidden="true" />
        </IconButton>
      </header>

      <div className="car-card__status">
        <StatusChip status={live.status} lifted={lifted} liftStops={car.stopWhenLifted} />
        {car.source === 'mock' && <span className="chip">{t('app.mockBadge')}</span>}
      </div>

      <dl className="car-card__facts">
        <div>
          <dt>{t('garage.lastDistance')}</dt>
          <dd>
            <MiniEcho cm={cm} />
            {d ? (
              <span className="num">
                {d.value} {d.unit}
              </span>
            ) : (
              <span className="car-card__muted">
                {cm === null && car.lastSeenAt ? t('radar.noEcho') : t('garage.noReading')}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>{connected ? t('garage.signal') : t('garage.power')}</dt>
          <dd>
            {connected && q !== null ? (
              <Bars level={q} label={`${t('garage.signal')} ${q} / 3`} />
            ) : power.level === 'check' ? (
              <span
                className="car-card__warn"
                title={t('garage.powerCheckBody', { name: car.name, n: power.drops })}
              >
                <BatteryWarning size={16} aria-hidden="true" />
                {t('garage.powerCheck')}
              </span>
            ) : (
              <span className="car-card__muted">{t('garage.powerOk')}</span>
            )}
          </dd>
        </div>
      </dl>

      <LiftStopSwitch car={car} />

      <div className="car-card__actions">
        {connected ? (
          <>
            <Button
              variant="quiet"
              onClick={() => void disconnectCar(car.id)}
              icon={<Power size={18} aria-hidden="true" />}
            >
              {t('common.disconnect')}
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate({ name: 'drive', carId: car.id })}
              icon={<Play size={18} aria-hidden="true" />}
              aria-label={`${t('common.drive')} ${car.name}`}
            >
              {t('common.drive')}
            </Button>
          </>
        ) : (
          <Button
            variant="glass"
            block
            disabled={live.status === 'connecting'}
            onClick={() => void connectCar(car.id)}
            icon={
              live.status === 'lost' ? (
                <RotateCw size={18} aria-hidden="true" />
              ) : (
                <Power size={18} aria-hidden="true" />
              )
            }
            aria-label={`${live.status === 'lost' ? t('common.reconnect') : t('common.connect')} ${car.name}`}
          >
            {live.status === 'connecting'
              ? t('status.connecting')
              : live.status === 'lost'
                ? t('common.reconnect')
                : t('common.connect')}
          </Button>
        )}
      </div>
    </article>
  );
}
