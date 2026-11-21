import { Play, Plus, Settings, Users } from 'lucide-react';
import { useEffect } from 'react';
import { navigate } from '../app/router';
import { t } from '../i18n/en';
import { useGarage } from '../store/garage';
import { useLive } from '../store/live';
import { BrandMark } from '../ui/BrandMark';
import { CarCard } from '../ui/CarCard';
import { Button, IconButton } from '../ui/primitives';
import { StopAllButton } from '../ui/shared';

/** Cards stagger in only on the first garage view of a session (decorative, never blocking). */
let entered = false;
const enterDelay = (i: number) => `${Math.round(70 * Math.sqrt(i))}ms`;

export function Garage() {
  const entrance = !entered;
  useEffect(() => {
    entered = true;
  }, []);
  const cars = useGarage((s) => s.cars);
  const lastDrivenId = useGarage((s) => s.lastDrivenId);
  const live = useLive((s) => s.cars);
  const connected = cars.filter((c) => live[c.id]?.status === 'connected');
  const driveCar = connected.find((c) => c.id === lastDrivenId) ?? connected[0];

  return (
    <main className="screen garage">
      <header className="topbar">
        <div className="brand">
          <BrandMark size={36} className="brand__mark" />
          <h1 className="topbar__title">{t('garage.title')}</h1>
        </div>
        <span className="topbar__spacer" />
        {connected.length > 0 && <StopAllButton />}
        <IconButton label={t('common.settings')} onClick={() => navigate({ name: 'settings' })}>
          <Settings size={22} aria-hidden="true" />
        </IconButton>
      </header>

      {cars.length === 0 ? (
        <section className="state garage__empty">
          <div className="empty-art" aria-hidden="true">
            <BrandMark size={112} motion="draw" />
          </div>
          <h2>{t('garage.emptyTitle')}</h2>
          <p>{t('garage.emptyBody')}</p>
          <div className="state__actions">
            <Button
              variant="primary"
              size="lg"
              block
              icon={<Plus size={20} aria-hidden="true" />}
              onClick={() => navigate({ name: 'add' })}
            >
              {t('garage.emptyAction')}
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section
            className={`garage__grid ${entrance ? 'garage__grid--enter' : ''}`}
            aria-label={t('garage.title')}
          >
            {cars.map((c, i) => (
              <CarCard key={c.id} car={c} enterDelay={enterDelay(i)} />
            ))}
          </section>

          <nav className="actionbar glass" aria-label={t('garage.actions')}>
            <Button
              variant="quiet"
              icon={<Plus size={20} aria-hidden="true" />}
              onClick={() => navigate({ name: 'add' })}
            >
              {t('garage.addCar')}
            </Button>
            {connected.length >= 2 && (
              <Button
                variant="caramel"
                icon={<Users size={20} aria-hidden="true" />}
                onClick={() => navigate({ name: 'group' })}
              >
                {t('garage.group')}
              </Button>
            )}
            {driveCar && (
              <Button
                variant="primary"
                className="actionbar__primary"
                icon={<Play size={20} aria-hidden="true" />}
                onClick={() => navigate({ name: 'drive', carId: driveCar.id })}
              >
                {t('garage.driveNamed', { name: driveCar.name })}
              </Button>
            )}
          </nav>
        </>
      )}
    </main>
  );
}
