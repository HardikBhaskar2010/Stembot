import { ArrowLeft, Download, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { goBack } from '../app/router';
import { connectedIds, describeCar, disconnectSource, sendRaw } from '../control/fleet';
import { t } from '../i18n/en';
import { CommandError, encodeCommand } from '../protocol/commands';
import {
  NAME_PREFIX,
  PIN_MAP,
  UART_NOTIFY_CHAR,
  UART_SERVICE,
  UART_WRITE_CHAR,
} from '../protocol/constants';
import { exportLog, useDevLog } from '../store/devlog';
import { useGarage } from '../store/garage';
import { useLive } from '../store/live';
import { useSettings } from '../store/settings';
import { getMockTransport, MOCK_CARS, type ServiceDescription } from '../transport';
import { Button, IconButton, Row, Switch } from '../ui/primitives';
import { useNow } from '../ui/shared';

type Tab = 'live' | 'log' | 'console' | 'device' | 'pins' | 'mock';
const TABS: Tab[] = ['live', 'log', 'console', 'device', 'pins', 'mock'];

export function Dev() {
  const [tab, setTab] = useState<Tab>('live');
  const cars = useGarage((s) => s.cars);
  const live = useLive((s) => s.cars);
  const connected = cars.filter((c) => live[c.id]?.status === 'connected');
  const [carId, setCarId] = useState<string>('');
  const selected = connected.find((c) => c.id === carId) ?? connected[0];

  return (
    <main className="screen dev">
      <header className="topbar">
        <IconButton label={t('common.back')} onClick={goBack}>
          <ArrowLeft size={22} aria-hidden="true" />
        </IconButton>
        <h1 className="topbar__title">{t('dev.title')}</h1>
      </header>

      <div className="dev__tabs glass" role="tablist" aria-label={t('dev.title')}>
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className="dev__tab"
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              const i = TABS.indexOf(tab);
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const next =
                  TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length] ??
                  'live';
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
          >
            {t(`dev.tabs.${id}`)}
          </button>
        ))}
      </div>

      {['live', 'console', 'device'].includes(tab) && connected.length > 1 && (
        <label className="dev__picker">
          <span>{t('dev.car')}</span>
          <select
            className="input dev__select"
            value={selected?.id ?? ''}
            onChange={(e) => setCarId(e.target.value)}
          >
            {connected.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <section
        className="dev__panel glass"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'live' && (
          <>
            <FirmwareStateTable />
            {selected ? <LivePanel carId={selected.id} /> : <Empty />}
          </>
        )}
        {tab === 'log' && <LogPanel />}
        {tab === 'console' && (selected ? <ConsolePanel carId={selected.id} /> : <Empty />)}
        {tab === 'device' && <DevicePanel key={selected?.id ?? 'none'} carId={selected?.id} />}
        {tab === 'pins' && <PinsPanel />}
        {tab === 'mock' && <MockPanel />}
      </section>
    </main>
  );
}

/** Firmware v2 settings the app last sent to each connected car, plus the raw `C:` reply. */
function FirmwareStateTable() {
  const cars = useGarage((s) => s.cars);
  const live = useLive((s) => s.cars);
  const connected = cars.filter((c) => live[c.id]?.status === 'connected');
  if (connected.length === 0) return null;
  return (
    <table className="dev__table dev__fw">
      <caption className="dev__h">{t('dev.fwTitle')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('dev.car')}</th>
          <th scope="col">{t('dev.fwLift')}</th>
          <th scope="col">{t('dev.fwObstacle')}</th>
          <th scope="col">m / k</th>
          <th scope="col">{t('dev.fwCaps')}</th>
        </tr>
      </thead>
      <tbody>
        {connected.map((c) => {
          const l = live[c.id];
          const fw = l?.fw;
          return (
            <tr key={c.id}>
              <th scope="row">{c.name}</th>
              <td className="dev__mono">
                {fw?.liftStop == null ? t('dev.fwNotSent') : fw.liftStop ? 'i1' : 'i0'}
              </td>
              <td className="dev__mono">
                {fw?.obstacleCm == null
                  ? t('dev.fwNotSent')
                  : fw.obstacleCm > 0
                    ? `o${fw.obstacleCm}`
                    : t('dev.fwOff')}
              </td>
              <td className="dev__mono">
                {fw?.carSounds === undefined ? '-' : fw.carSounds ? 'm1' : 'm0'}
                {' / '}
                {fw?.clapMode === undefined ? '-' : fw.clapMode ? 'k1' : 'k0'}
              </td>
              <td className="dev__mono">{l?.capsRaw ?? t('dev.fwNoReply')}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Empty() {
  return <p className="dev__empty">{t('dev.noConnected')}</p>;
}

function LivePanel({ carId }: { carId: string }) {
  const entries = useDevLog((s) => s.entries);
  const l = useLive((s) => s.cars[carId]);
  const now = useNow(500);
  const rx = useMemo(
    () => entries.filter((e) => e.carId === carId && e.dir === 'rx').slice(-40),
    [entries, carId],
  );
  const rate = (l?.rxTimes ?? []).filter((x) => now - x < 3000).length / 3;
  return (
    <div className="dev__grid">
      <dl className="dev__stats">
        <Stat label={t('dev.rate')} value={`${rate.toFixed(1)} /s`} />
        <Stat label={t('dev.sent')} value={String(l?.stats?.sent ?? 0)} />
        <Stat label={t('dev.superseded')} value={String(l?.stats?.superseded ?? 0)} />
        <Stat label={t('dev.failed')} value={String(l?.stats?.failed ?? 0)} />
        <Stat label={t('dev.timedOut')} value={String(l?.stats?.timedOut ?? 0)} />
        <Stat label={t('dev.avgWrite')} value={`${(l?.stats?.avgWriteMs ?? 0).toFixed(1)} ms`} />
      </dl>
      <div>
        <h3 className="dev__h">Parsed</h3>
        <pre className="dev__pre" tabIndex={0} aria-label="Parsed telemetry">
          {JSON.stringify(
            {
              telemetry: l?.telemetry ?? null,
              motion: l?.motion ?? null,
              lastClap: l?.lastClap ?? null,
              capabilities: l?.capabilities ?? null,
            },
            null,
            2,
          )}
        </pre>
      </div>
      <div>
        <h3 className="dev__h">Raw stream</h3>
        <pre className="dev__pre dev__pre--log" tabIndex={0} aria-label="Raw stream">
          {rx.map((e) => `${new Date(e.t).toISOString().slice(11, 23)}  ${e.text}`).join('\n') ||
            t('dev.empty')}
        </pre>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="dev__stat">
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

function LogPanel() {
  const entries = useDevLog((s) => s.entries);
  const clear = useDevLog((s) => s.clear);
  const cars = useGarage((s) => s.cars);
  const names = useMemo(() => Object.fromEntries(cars.map((c) => [c.id, c.name])), [cars]);
  const recent = entries.slice(-200);
  const download = () => {
    const blob = new Blob([exportLog(entries, names)], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stembot-log-${new Date().toISOString().replace(/[:.]/g, '-')}.tsv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="dev__stack">
      <div className="dev__actions">
        <Button
          variant="glass"
          icon={<Download size={18} aria-hidden="true" />}
          onClick={download}
          disabled={entries.length === 0}
        >
          {t('dev.export')}
        </Button>
        <Button variant="quiet" icon={<Trash2 size={18} aria-hidden="true" />} onClick={clear}>
          {t('dev.clear')}
        </Button>
      </div>
      <pre className="dev__pre dev__pre--log" tabIndex={0} aria-label="Command log">
        {recent.length === 0
          ? t('dev.empty')
          : recent
              .map(
                (e) =>
                  `${new Date(e.t).toISOString().slice(11, 23)}  ${(names[e.carId] ?? e.carId).padEnd(10).slice(0, 10)}  ${e.dir.padEnd(4)}  ${e.text}${e.ms !== undefined ? `  (${e.ms.toFixed(0)} ms)` : ''}`,
              )
              .join('\n')}
      </pre>
    </div>
  );
}

function ConsolePanel({ carId }: { carId: string }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const send = () => {
    try {
      encodeCommand({ kind: 'raw', text });
      sendRaw(carId, text);
      setError(null);
      setText('');
    } catch (e) {
      setError(e instanceof CommandError ? e.message : String(e));
    }
  };
  return (
    <form
      className="dev__stack"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label className="field">
        <span className="field__label">{t('dev.manualLabel')}</span>
        <input
          className="input dev__mono"
          value={text}
          maxLength={19}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="console-help"
          aria-invalid={Boolean(error)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <p
        id="console-help"
        className={error ? 'dev__error' : 'row__hint'}
        role={error ? 'alert' : undefined}
      >
        {error ?? t('dev.manualHelp')}
      </p>
      <Button variant="primary" type="submit">
        {t('dev.send')}
      </Button>
    </form>
  );
}

function DevicePanel({ carId }: { carId?: string }) {
  const [services, setServices] = useState<ServiceDescription[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="dev__stack">
      <dl className="dev__kv">
        <dt>Name filter</dt>
        <dd className="dev__mono">{NAME_PREFIX}*</dd>
        <dt>UART service</dt>
        <dd className="dev__mono">{UART_SERVICE}</dd>
        <dt>Write (app → car)</dt>
        <dd className="dev__mono">{UART_WRITE_CHAR}</dd>
        <dt>Notify (car → app)</dt>
        <dd className="dev__mono">{UART_NOTIFY_CHAR}</dd>
      </dl>
      <p className="row__hint">{t('dev.uuidNote')}</p>
      <Button
        variant="glass"
        disabled={!carId}
        onClick={() => {
          if (!carId) return;
          setErr(null);
          describeCar(carId)
            .then(setServices)
            .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
        }}
      >
        {t('dev.readServices')}
      </Button>
      {err && <p className="dev__error">{err}</p>}
      {services && (
        <ul className="dev__services">
          {services.map((s) => (
            <li key={s.uuid}>
              <span className="dev__mono">{s.uuid}</span>
              <ul>
                {s.characteristics.map((c) => (
                  <li key={c.uuid}>
                    <span className="dev__mono">{c.uuid}</span>{' '}
                    <span className="chip">{c.properties.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PinsPanel() {
  return (
    <div className="dev__stack">
      <table className="dev__table">
        <caption className="row__hint">STEMROBO BMBRK V1.1, measured Nov 2026. Read-only.</caption>
        <thead>
          <tr>
            <th scope="col">Function</th>
            <th scope="col">Pin</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {PIN_MAP.map((p) => (
            <tr key={p.fn}>
              <td>{p.fn}</td>
              <td className="num">{p.pin}</td>
              <td>{p.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="row__hint">
        Firmware also has a FLIP constant for reversed wheels; the app's per-car Reverse wheels
        setting does the same without a reflash.
      </p>
    </div>
  );
}

function MockPanel() {
  const mockMode = useSettings((s) => s.mockMode);
  const set = useSettings((s) => s.set);
  const cars = useGarage((s) => s.cars.filter((c) => c.source === 'mock'));
  const live = useLive((s) => s.cars);
  const [lifted, setLifted] = useState<Record<string, boolean>>({});
  const ids = connectedIds();
  return (
    <div className="dev__stack">
      <div className="rows">
        <Row
          label={t('dev.mockMode')}
          hint={t('dev.mockBody')}
          control={
            <Switch
              label={t('dev.mockMode')}
              checked={mockMode}
              onChange={(v) => {
                set('mockMode', v);
                if (!v) void disconnectSource('mock');
              }}
            />
          }
        />
      </div>
      {cars
        .filter((c) => live[c.id]?.status === 'connected' && ids.includes(c.id))
        .map((c) => (
          <div key={c.id} className="dev__mockrow">
            <span>
              {c.name}{' '}
              <span className="row__hint">{MOCK_CARS.find((m) => m.id === c.deviceId)?.name}</span>
            </span>
            <Button
              variant="glass"
              onClick={() => {
                const next = !lifted[c.id];
                getMockTransport().setLifted(c.deviceId, next);
                setLifted((s) => ({ ...s, [c.id]: next }));
              }}
            >
              {lifted[c.id] ? t('dev.putDown', { name: c.name }) : t('dev.lift', { name: c.name })}
            </Button>
            <Button
              variant="quiet"
              className="btn--danger-text"
              onClick={() => getMockTransport().dropConnection(c.deviceId)}
            >
              {t('dev.drop', { name: c.name })}
            </Button>
          </div>
        ))}
    </div>
  );
}
