import {
  ArrowLeft,
  BluetoothOff,
  Copy,
  Globe,
  Lock,
  Power,
  SearchX,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { goBack, navigate } from '../app/router';
import { openSession } from '../control/fleet';
import { t } from '../i18n/en';
import {
  CAR_COLORS,
  nextFreeColor,
  useGarage,
  type CarColorId,
  type SavedCar,
} from '../store/garage';
import { useNotify } from '../store/notify';
import { useSettings } from '../store/settings';
import {
  getTransport,
  TransportError,
  type DeviceInfo,
  type TransportErrorCode,
} from '../transport';
import { Button, IconButton } from '../ui/primitives';

type Problem = TransportErrorCode | 'insecure' | 'already';

type Step =
  | { name: 'power' }
  | { name: 'picking' }
  | { name: 'connecting' }
  | { name: 'naming'; car: SavedCar }
  | { name: 'problem'; problem: Problem; existing?: SavedCar };

export function AddCar() {
  const mock = useSettings((s) => s.mockMode);
  const cars = useGarage((s) => s.cars);
  const [step, setStep] = useState<Step>({ name: 'power' });

  // Check support up front so unsupported browsers see the alternative immediately.
  useEffect(() => {
    let alive = true;
    void getTransport(mock)
      .checkSupport()
      .then((r) => {
        if (!alive || r.ok) return;
        setStep({
          name: 'problem',
          problem: r.reason === 'bluetooth-off' ? 'bluetooth-off' : r.reason,
        });
      });
    return () => {
      alive = false;
    };
  }, [mock]);

  const find = async () => {
    const transport = getTransport(mock);
    setStep({ name: 'picking' });
    let device: DeviceInfo;
    try {
      device = await transport.requestDevice();
    } catch (e) {
      setStep({ name: 'problem', problem: e instanceof TransportError ? e.code : 'not-found' });
      return;
    }
    const existing = useGarage.getState().cars.find((c) => c.deviceId === device.id);
    if (existing) {
      setStep({ name: 'problem', problem: 'already', existing });
      return;
    }
    const garage = useGarage.getState();
    const car = garage.addCar({
      name: `Car ${String.fromCharCode(65 + Math.min(25, garage.cars.length))}`,
      color: nextFreeColor(garage.cars),
      deviceId: device.id,
      deviceName: device.name,
      source: mock ? 'mock' : 'real',
    });
    setStep({ name: 'connecting' });
    try {
      await openSession(car);
      setStep({ name: 'naming', car });
    } catch (e) {
      garage.removeCar(car.id);
      setStep({
        name: 'problem',
        problem: e instanceof TransportError ? e.code : 'connect-failed',
      });
    }
  };

  const stepNo = step.name === 'naming' ? 3 : step.name === 'power' ? 1 : 2;

  return (
    <main className="screen add">
      <header className="topbar">
        <IconButton label={t('common.back')} onClick={goBack}>
          <ArrowLeft size={22} aria-hidden="true" />
        </IconButton>
        <h1 className="topbar__title">{t('add.title')}</h1>
      </header>

      <div className="add__body">
        {step.name !== 'problem' && (
          <ol className="steps" aria-label={t('add.stepOf', { n: stepNo })}>
            {[1, 2, 3].map((n) => (
              <li
                key={n}
                className={`steps__dot ${n <= stepNo ? 'steps__dot--on' : ''}`}
                aria-current={n === stepNo ? 'step' : undefined}
              >
                <span className="sr-only">{t('add.stepOf', { n })}</span>
              </li>
            ))}
          </ol>
        )}

        {step.name === 'power' && (
          <StepPanel
            icon={<Power size={34} aria-hidden="true" />}
            title={t('add.step1Title')}
            body={t('add.step1Body')}
          >
            <Button variant="primary" size="lg" block onClick={() => void find()}>
              {t('add.step1Action')}
            </Button>
            {cars.length === 0 && mock && <p className="add__note">{t('app.mockBadge')}</p>}
          </StepPanel>
        )}

        {step.name === 'picking' && (
          <StepPanel
            icon={<span className="scan" aria-hidden="true" />}
            title={t('add.step2Title')}
            body={t('add.step2Body')}
          >
            <p className="add__wait" role="status">
              {t('add.searching')}
            </p>
          </StepPanel>
        )}

        {step.name === 'connecting' && (
          <StepPanel
            icon={<span className="scan" aria-hidden="true" />}
            title={t('add.step2Title')}
            body=""
          >
            <p className="add__wait" role="status">
              {t('add.connecting')}
            </p>
          </StepPanel>
        )}

        {step.name === 'naming' && <NameStep car={step.car} />}

        {step.name === 'problem' && <ProblemPanel step={step} onRetry={() => void find()} />}
      </div>
    </main>
  );
}

function StepPanel({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section className="state add__panel">
      <div className="state__icon glass">{icon}</div>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      <div className="state__actions">{children}</div>
    </section>
  );
}

function NameStep({ car }: { car: SavedCar }) {
  const update = useGarage((s) => s.updateCar);
  const setLast = useGarage((s) => s.setLastDriven);
  const [name, setName] = useState(car.name);
  const [color, setColor] = useState<CarColorId>(car.color);
  const save = () => update(car.id, { name, color });

  return (
    <section className="add__panel add__name">
      <h2>{t('add.step3Title')}</h2>
      <label className="field">
        <span className="field__label">{t('add.nameLabel')}</span>
        <input
          className="input"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="field">
        <span className="field__label" id="add-color">
          {t('add.colorLabel')}
        </span>
        <div className="swatches" role="radiogroup" aria-labelledby="add-color">
          {CAR_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={color === c.id}
              aria-label={c.label}
              className="swatch"
              style={{ ['--tag' as string]: c.value }}
              onClick={() => setColor(c.id)}
            >
              <span className="swatch__dot" />
            </button>
          ))}
        </div>
      </div>
      <div className="state__actions add__actions">
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => {
            save();
            setLast(car.id);
            navigate({ name: 'drive', carId: car.id }, { replace: true });
          }}
        >
          {t('add.start')}
        </Button>
        <Button
          variant="quiet"
          block
          onClick={() => {
            save();
            navigate({ name: 'garage' }, { replace: true });
          }}
        >
          {t('add.toGarage')}
        </Button>
      </div>
    </section>
  );
}

function ProblemPanel({
  step,
  onRetry,
}: {
  step: Extract<Step, { name: 'problem' }>;
  onRetry: () => void;
}) {
  const toast = useNotify((s) => s.toast);
  const p = step.problem;

  if (p === 'unsupported' || p === 'insecure') {
    return (
      <StepPanel
        icon={
          p === 'insecure' ? (
            <Lock size={32} aria-hidden="true" />
          ) : (
            <Globe size={32} aria-hidden="true" />
          )
        }
        title={p === 'insecure' ? t('add.insecureTitle') : t('add.unsupportedTitle')}
        body={p === 'insecure' ? t('add.insecureBody') : t('add.unsupportedBody')}
      >
        <Button
          variant="primary"
          block
          icon={<Copy size={18} aria-hidden="true" />}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(location.href.split('#')[0] ?? location.href)
              .then(() => toast({ tone: 'success', title: t('add.copied') }));
          }}
        >
          {t('add.copyLink')}
        </Button>
        <Button
          variant="quiet"
          block
          onClick={() => navigate({ name: 'garage' }, { replace: true })}
        >
          {t('add.toGarageShort')}
        </Button>
      </StepPanel>
    );
  }

  if (p === 'already' && step.existing) {
    return (
      <StepPanel
        icon={<Sparkles size={32} aria-hidden="true" />}
        title={t('add.alreadyTitle', { name: step.existing.name })}
        body={t('add.alreadyBody')}
      >
        <Button
          variant="primary"
          block
          onClick={() => navigate({ name: 'garage' }, { replace: true })}
        >
          {t('add.toGarageShort')}
        </Button>
      </StepPanel>
    );
  }

  const map: Partial<
    Record<Problem, { icon: ReactNode; title: string; body: string; tone: string }>
  > = {
    'bluetooth-off': {
      icon: <BluetoothOff size={32} aria-hidden="true" />,
      title: t('add.offTitle'),
      body: t('add.offBody'),
      tone: 'warn',
    },
    'permission-denied': {
      icon: <ShieldAlert size={32} aria-hidden="true" />,
      title: t('add.deniedTitle'),
      body: t('add.deniedBody'),
      tone: 'warn',
    },
    cancelled: {
      icon: <SearchX size={32} aria-hidden="true" />,
      title: t('add.cancelledTitle'),
      body: t('add.cancelledBody'),
      tone: '',
    },
  };
  const m = map[p] ?? {
    icon: <SearchX size={32} aria-hidden="true" />,
    title: t('add.failedTitle'),
    body: t('add.failedBody'),
    tone: 'danger',
  };

  return (
    <section className="state add__panel" role="alert">
      <div className={`state__icon glass ${m.tone ? `state__icon--${m.tone}` : ''}`}>{m.icon}</div>
      <h2>{m.title}</h2>
      <p>{m.body}</p>
      <div className="state__actions">
        <Button variant="primary" size="lg" block onClick={onRetry}>
          {t('common.tryAgain')}
        </Button>
      </div>
    </section>
  );
}
