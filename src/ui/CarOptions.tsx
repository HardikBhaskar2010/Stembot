import { useId } from 'react';
import { Compass } from 'lucide-react';
import { setClapMode, setNorthHere, setObstacleStop, setStopWhenLifted } from '../control/fleet';
import { t } from '../i18n/en';
import { OBSTACLE_CHOICES } from '../protocol/constants';
import { canUseObstacleStop, hasCompass, type SavedCar } from '../store/garage';
import { useLive } from '../store/live';
import { useNotify } from '../store/notify';
import { Button, Segmented, Switch } from './primitives';

/** "Stop when lifted" switch for one car (firmware v2 `i1` / `i0`). */
export function LiftStopSwitch({ car, withHint = false }: { car: SavedCar; withHint?: boolean }) {
  const id = useId();
  return (
    <div className="car-option">
      <div className="car-option__text">
        <span className="car-option__label" id={id}>
          {t('lift.title')}
        </span>
        {withHint && <span className="car-option__hint">{t('lift.hint')}</span>}
      </div>
      <Switch
        labelledBy={id}
        checked={car.stopWhenLifted}
        onChange={(v) => setStopWhenLifted(car.id, v)}
      />
    </div>
  );
}

/**
 * Forward obstacle stop for one car (firmware v2 `o<cm>`). Hidden when the car reports
 * it has no distance sensor. Worded as "helps": the sensor misses legs and corners.
 */
export function ObstacleStopControl({ car }: { car: SavedCar }) {
  const id = useId();
  if (!canUseObstacleStop(car)) return null;
  type Choice = `${(typeof OBSTACLE_CHOICES)[number]}`;
  const value = String(
    OBSTACLE_CHOICES.includes(car.obstacleCm as (typeof OBSTACLE_CHOICES)[number])
      ? car.obstacleCm
      : 0,
  ) as Choice;
  return (
    <div className="car-option car-option--stack">
      <div className="car-option__text">
        <span className="car-option__label" id={id}>
          {t('obstacle.title')}
        </span>
        <span className="car-option__hint">{t('obstacle.hint')}</span>
      </div>
      <Segmented<Choice>
        label={`${t('obstacle.title')}, ${car.name}`}
        value={value}
        onChange={(v) => setObstacleStop(car.id, Number(v))}
        options={OBSTACLE_CHOICES.map((cm) => ({
          value: String(cm) as Choice,
          label: cm === 0 ? t('obstacle.off') : t('obstacle.cm', { n: cm }),
        }))}
      />
    </div>
  );
}

/**
 * Clap commands (firmware v2.1 `k1`/`k0`): the car listens with its own microphone.
 * Shown once the car has reported firmware v2.1 (it reports a compass).
 */
export function ClapSwitch({ car, withHint = false }: { car: SavedCar; withHint?: boolean }) {
  const id = useId();
  if (!hasCompass(car)) return null;
  return (
    <div className="car-option">
      <div className="car-option__text">
        <span className="car-option__label" id={id}>
          {t('clap.title')}
        </span>
        {withHint && <span className="car-option__hint">{t('clap.hint')}</span>}
      </div>
      <Switch labelledBy={id} checked={car.clapMode} onChange={(v) => setClapMode(car.id, v)} />
    </div>
  );
}

/** "Set current direction as north": the micro:bit may be mounted any way round. */
export function NorthButton({ car }: { car: SavedCar }) {
  const heading = useLive((s) => s.cars[car.id]?.motion?.headingDeg ?? null);
  if (!hasCompass(car)) return null;
  return (
    <div className="car-option car-option--stack">
      <div className="car-option__text">
        <span className="car-option__label">{t('compass.label')}</span>
        <span className="car-option__hint">
          {heading === null ? t('compass.calibrateHow') : t('compass.setNorthHint')}
        </span>
      </div>
      <Button
        variant="glass"
        disabled={heading === null}
        icon={<Compass size={18} aria-hidden="true" />}
        onClick={() => {
          if (setNorthHere(car.id))
            useNotify
              .getState()
              .toast({ tone: 'success', title: t('compass.northSet', { name: car.name }) });
        }}
      >
        {t('compass.setNorth')}
      </Button>
    </div>
  );
}
