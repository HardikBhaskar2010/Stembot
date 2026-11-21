import { ArrowLeft, Settings2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { goBack, navigate } from '../app/router';
import { connectCar } from '../control/fleet';
import { t } from '../i18n/en';
import { TELEMETRY_STALE_MS } from '../protocol/constants';
import { colorValue, useGarage } from '../store/garage';
import { linkQuality, liveOf, useLive } from '../store/live';
import { useNotify } from '../store/notify';
import { useSettings } from '../store/settings';
import { useUi } from '../store/ui';
import { DriveDeck } from '../ui/DriveDeck';
import { Bars, Button, IconButton } from '../ui/primitives';
import { Radar, zoneOf, type RadarState } from '../ui/Radar';
import { CompassBadge } from '../ui/Compass';
import { StatusChip, useNow } from '../ui/shared';

export function Drive({ carId }: { carId: string }) {
  const car = useGarage((s) => s.cars.find((c) => c.id === carId));
  const setLast = useGarage((s) => s.setLastDriven);
  const live = useLive((s) => liveOf(s, carId));
  const units = useSettings((s) => s.units);
  const setTargets = useUi((s) => s.setTargets);
  const editCar = useUi((s) => s.editCar);
  const now = useNow(250);

  useEffect(() => {
    setTargets([carId]);
    setLast(carId);
    return () => setTargets(null);
  }, [carId, setTargets, setLast]);

  const connected = live.status === 'connected';
  const tel = live.telemetry;
  const stale = !live.telemetryAt || now - live.telemetryAt > TELEMETRY_STALE_MS;
  const liftStops = car?.stopWhenLifted ?? false;
  // Lifted only blocks driving when this car's "Stop when lifted" is on (firmware v2 default: off).
  const state: RadarState = !connected
    ? 'offline'
    : tel?.lifted
      ? liftStops
        ? 'lifted'
        : 'lifted-drivable'
      : stale || !tel
        ? 'waiting'
        : tel.distanceCm === null
          ? 'no-echo'
          : 'live';

  useZoneAnnouncements(state, tel?.distanceCm ?? null);

  if (!car) {
    return (
      <main className="screen">
        <section className="state">
          <h1>{t('drive.noCar')}</h1>
          <Button variant="primary" onClick={() => navigate({ name: 'garage' }, { replace: true })}>
            {t('add.toGarageShort')}
          </Button>
        </section>
      </main>
    );
  }

  const q = linkQuality(live, now);

  return (
    <main className="screen drive" style={{ ['--tag' as string]: colorValue(car.color) }}>
      <header className="topbar drive__bar">
        <IconButton label={t('common.back')} onClick={goBack}>
          <ArrowLeft size={22} aria-hidden="true" />
        </IconButton>
        <span className="tag" aria-hidden="true" />
        <h1 className="topbar__title">{car.name}</h1>
        {connected && q !== null && <Bars level={q} label={`${t('garage.signal')} ${q} / 3`} />}
        <StatusChip status={live.status} lifted={tel?.lifted ?? false} liftStops={liftStops} />
        <IconButton label={t('garage.editCar', { name: car.name })} onClick={() => editCar(car.id)}>
          <Settings2 size={20} aria-hidden="true" />
        </IconButton>
      </header>

      {!connected && (
        <div className="drive__offline glass" role="status">
          <div>
            <strong>
              {live.status === 'lost' ? t('events.lost', { name: car.name }) : t('drive.noCar')}
            </strong>
            <span>{live.status === 'lost' ? t('events.lostBody') : t('drive.noCarBody')}</span>
          </div>
          <Button
            variant="primary"
            disabled={live.status === 'connecting'}
            onClick={() => void connectCar(car.id)}
          >
            {live.status === 'connecting'
              ? t('status.connecting')
              : live.status === 'lost'
                ? t('common.reconnect')
                : t('common.connect')}
          </Button>
        </div>
      )}

      <DriveDeck
        targets={[carId]}
        disabled={!connected || state === 'lifted'}
        radar={
          <Radar
            state={state}
            distanceCm={tel?.distanceCm ?? null}
            units={units}
            carName={car.name}
            bump={live.bumpAt !== null && now - live.bumpAt < 700}
            overlay={
              <>
                <CompassBadge car={car} live={live} now={now} />
                {connected && car.clapMode && (
                  <span className="chip chip--clap">
                    {live.lastClap && now - live.lastClap.at < 2500
                      ? t(`clap.heard${live.lastClap.claps}`, { name: car.name })
                      : t('clap.listening')}
                  </span>
                )}
              </>
            }
          />
        }
      />
    </main>
  );
}

/** Announce only when the zone or state changes, never every reading. */
function useZoneAnnouncements(state: RadarState, cm: number | null) {
  const announce = useNotify((s) => s.announce);
  const last = useRef<string>('');
  useEffect(() => {
    const key = state === 'live' && cm !== null ? zoneOf(cm) : state;
    if (key === last.current) return;
    const prev = last.current;
    last.current = key;
    if (!prev) return;
    if (key === 'very-close') announce(t('radar.veryClose'), true);
    else if (key === 'close') announce(t('radar.close'));
    else if (key === 'no-echo') announce(t('radar.noEcho'));
  }, [state, cm, announce]);
}
