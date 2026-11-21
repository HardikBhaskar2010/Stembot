import { ArrowLeft, Info, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { goBack, navigate } from '../app/router';
import { release } from '../control/fleet';
import { t } from '../i18n/en';
import { SPEED_MAX, SPEED_MIN } from '../protocol/constants';
import { colorValue, useGarage, type SavedCar } from '../store/garage';
import { useLive } from '../store/live';
import { useSettings } from '../store/settings';
import { useUi } from '../store/ui';
import { DriveDeck } from '../ui/DriveDeck';
import { Button, IconButton, Slider, Switch } from '../ui/primitives';
import { formatDistance } from '../ui/Radar';

export function Group() {
  const cars = useGarage((s) => s.cars);
  const update = useGarage((s) => s.updateCar);
  const live = useLive((s) => s.cars);
  const setTargets = useUi((s) => s.setTargets);
  const [tuning, setTuning] = useState(false);

  const connected = useMemo(
    () => cars.filter((c) => live[c.id]?.status === 'connected'),
    [cars, live],
  );
  const groupCars = useMemo(
    () => cars.filter((c) => c.inGroup || live[c.id]?.status === 'connected'),
    [cars, live],
  );
  const targets = useMemo(
    () => connected.filter((c) => c.inGroup && !live[c.id]?.telemetry?.lifted).map((c) => c.id),
    [connected, live],
  );
  const targetKey = targets.join(',');

  useEffect(() => {
    setTargets(targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, setTargets]);
  useEffect(() => () => setTargets(null), [setTargets]);

  const toggle = (c: SavedCar, on: boolean) => {
    if (!on) release([c.id]); // a car leaving the group stops
    update(c.id, { inGroup: on });
  };

  return (
    <main className="screen drive group">
      <header className="topbar drive__bar">
        <IconButton label={t('common.back')} onClick={goBack}>
          <ArrowLeft size={22} aria-hidden="true" />
        </IconButton>
        <h1 className="topbar__title">{t('group.title')}</h1>
        <span className="chip group__count">
          {t('group.included', { n: targets.length, total: connected.length })}
        </span>
        <IconButton
          label={t('group.tune')}
          aria-expanded={tuning}
          onClick={() => setTuning((v) => !v)}
        >
          <SlidersHorizontal size={20} aria-hidden="true" />
        </IconButton>
      </header>

      {connected.length < 2 && (
        <div className="drive__offline glass" role="status">
          <div>
            <strong>{t('group.noneTitle')}</strong>
            <span>{t('group.noneBody')}</span>
          </div>
          <Button variant="primary" onClick={() => navigate({ name: 'garage' })}>
            {t('add.toGarageShort')}
          </Button>
        </div>
      )}

      {tuning && <TunePanel cars={groupCars} />}

      <DriveDeck
        mode="group"
        targets={targets}
        disabled={targets.length === 0}
        radar={
          <section className="fleet" aria-label={t('group.title')}>
            <ul className="fleet__list">
              {groupCars.map((c) => (
                <FleetRow key={c.id} car={c} onToggle={toggle} />
              ))}
            </ul>
            <p className="fleet__drift">
              <Info size={16} aria-hidden="true" />
              {t('group.drift')}
            </p>
          </section>
        }
      />
    </main>
  );
}

function FleetRow({
  car,
  onToggle,
}: {
  car: SavedCar;
  onToggle: (c: SavedCar, on: boolean) => void;
}) {
  const l = useLive((s) => s.cars[car.id]);
  const units = useSettings((s) => s.units);
  const status = l?.status ?? 'offline';
  const lifted = status === 'connected' && Boolean(l?.telemetry?.lifted);
  const cm = l?.telemetry?.distanceCm ?? null;
  const d = cm !== null ? formatDistance(cm, units) : null;
  const problem = status === 'lost' || status === 'failed' || lifted;
  const id = `fleet-${car.id}`;
  return (
    <li
      className={`fleet__row ${problem ? 'fleet__row--problem' : ''}`}
      style={{ ['--tag' as string]: colorValue(car.color) }}
    >
      <span className="tag" aria-hidden="true" />
      <div className="fleet__text">
        <span className="fleet__name" id={id}>
          {car.name}
        </span>
        <span className={`fleet__state fleet__state--${lifted ? 'lifted' : status}`}>
          {lifted
            ? t('radar.lifted')
            : status === 'connected'
              ? d
                ? `${d.value} ${d.unit}`
                : t('radar.noEcho')
              : t(`status.${status}`)}
        </span>
      </div>
      <Switch
        label={t('group.include', { name: car.name })}
        checked={car.inGroup}
        disabled={status !== 'connected'}
        onChange={(v) => onToggle(car, v)}
      />
    </li>
  );
}

function TunePanel({ cars }: { cars: SavedCar[] }) {
  const update = useGarage((s) => s.updateCar);
  const editCar = useUi((s) => s.editCar);
  return (
    <section className="tune glass" aria-label={t('group.tune')}>
      {cars.map((c) => (
        <div key={c.id} className="tune__row" style={{ ['--tag' as string]: colorValue(c.color) }}>
          <button type="button" className="tune__name" onClick={() => editCar(c.id)}>
            <span className="tag" aria-hidden="true" />
            {c.name}
          </button>
          <div className="tune__speed">
            <span className="num tune__value">{c.speed}</span>
            <Slider
              label={t('group.speedFor', { name: c.name })}
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={1}
              value={c.speed}
              onChange={(v) => update(c.id, { speed: v })}
            />
          </div>
          <label className="tune__rev">
            <span>{t('group.reverse')}</span>
            <Switch
              label={t('group.reverseFor', { name: c.name })}
              checked={c.reversed}
              onChange={(v) => update(c.id, { reversed: v })}
            />
          </label>
        </div>
      ))}
    </section>
  );
}
