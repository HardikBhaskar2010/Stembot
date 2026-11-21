import { t } from '../i18n/en';
import { haptic, sound } from '../platform/feedback';
import { effectiveSpeed, type Direction } from '../protocol/commands';
import { NUDGE_MS, SPIN_MS } from '../protocol/constants';
import { LineAssembler, parseLine } from '../protocol/telemetry';
import { useDevLog } from '../store/devlog';
import { useGarage, type SavedCar } from '../store/garage';
import { useLive } from '../store/live';
import { useNotify } from '../store/notify';
import { useSettings } from '../store/settings';
import {
  getTransport,
  TransportError,
  type CarConnection,
  type DeviceInfo,
  type ServiceDescription,
} from '../transport';
import { CarLink, type LinkEvent } from './CarLink';

interface Session {
  carId: string;
  conn: CarConnection;
  link: CarLink;
  assembler: LineAssembler;
  lifted: boolean;
  lastPersistAt: number;
}

const sessions = new Map<string, Session>();
const connecting = new Set<string>();

function car(carId: string): SavedCar | undefined {
  return useGarage.getState().cars.find((c) => c.id === carId);
}

function logLinkEvent(carId: string, e: LinkEvent) {
  const log = useDevLog.getState();
  if (!log.enabled) return;
  const text = e.line.replace('\n', '\\n');
  if (e.type === 'tx') log.add({ t: Date.now(), carId, dir: 'tx', text, ms: e.ms });
  else if (e.type === 'superseded') log.add({ t: Date.now(), carId, dir: 'drop', text });
  else log.add({ t: Date.now(), carId, dir: 'err', text: `${text}  ${e.message}` });
}

/** Push link stats into the live store a few times a second (cheap, and only while connected). */
setInterval(() => {
  for (const s of sessions.values()) {
    useLive.getState().patch(s.carId, { stats: { ...s.link.stats }, driving: s.link.isDriving });
  }
}, 500);

function applyBlock(s: Session) {
  s.link.setBlocked(s.lifted || useLive.getState().locked);
}

function onLine(s: Session, line: string) {
  const parsed = parseLine(line);
  const live = useLive.getState();
  const log = useDevLog.getState();
  const name = car(s.carId)?.name ?? '';
  if (parsed.type === 'telemetry') {
    const now = Date.now();
    const prev = live.cars[s.carId];
    const rxTimes = [...(prev?.rxTimes ?? []), now].slice(-30);
    live.patch(s.carId, { telemetry: parsed.value, telemetryAt: now, rxTimes });
    if (parsed.value.lifted !== s.lifted) {
      s.lifted = parsed.value.lifted;
      applyBlock(s);
      if (s.lifted) {
        haptic('warning');
        useNotify.getState().announce(t('events.lifted', { name }), true);
      } else useNotify.getState().announce(t('events.landed', { name }));
    }
    if (now - s.lastPersistAt > 2000) {
      s.lastPersistAt = now;
      useGarage
        .getState()
        .updateCar(s.carId, { lastDistanceCm: parsed.value.distanceCm, lastSeenAt: now });
    }
    if (log.enabled)
      log.add({
        t: now,
        carId: s.carId,
        dir: 'rx',
        text: line,
        json: JSON.stringify(parsed.value),
      });
  } else if (parsed.type === 'capabilities') {
    live.patch(s.carId, { capabilities: parsed.value });
    log.add({
      t: Date.now(),
      carId: s.carId,
      dir: 'rx',
      text: line,
      json: JSON.stringify(parsed.value),
    });
  } else if (parsed.type === 'invalid') {
    log.add({
      t: Date.now(),
      carId: s.carId,
      dir: 'err',
      text: `${parsed.raw}  (${parsed.reason})`,
    });
  } else {
    log.add({ t: Date.now(), carId: s.carId, dir: 'rx', text: parsed.raw });
  }
}

function handleLost(carId: string) {
  const s = sessions.get(carId);
  if (!s) return;
  s.link.dispose();
  sessions.delete(carId);
  const c = car(carId);
  useLive.getState().patch(carId, { status: 'lost', driving: false, telemetry: null });
  useGarage.getState().recordDrop(carId, Date.now());
  useDevLog.getState().add({ t: Date.now(), carId, dir: 'sys', text: 'link lost' });
  const name = c?.name ?? '';
  haptic('warning');
  sound('lost');
  useNotify.getState().announce(t('events.lost', { name }), true);
  useNotify.getState().toast(
    {
      tone: 'danger',
      title: t('events.lost', { name }),
      body: t('events.lostBody'),
      action: { label: t('common.reconnect'), run: () => void connectCar(carId) },
    },
    9000,
  );
}

async function pickAndBind(target: SavedCar): Promise<SavedCar> {
  const transport = getTransport(target.source === 'mock');
  const picked: DeviceInfo = await transport.requestDevice();
  if (picked.id === target.deviceId) return target;
  const owner = useGarage.getState().cars.find((c) => c.deviceId === picked.id);
  if (owner) {
    useNotify.getState().toast({ tone: 'info', title: t('events.swapped', { name: owner.name }) });
    return owner;
  }
  useGarage.getState().updateCar(target.id, { deviceId: picked.id, deviceName: picked.name });
  useNotify.getState().toast({ tone: 'info', title: t('events.rebound', { name: target.name }) });
  return { ...target, deviceId: picked.id, deviceName: picked.name };
}

/** Connect a saved car. Shows the chooser only if the platform forgot the device. Call from a tap. */
export async function connectCar(carId: string): Promise<void> {
  let c = car(carId);
  if (!c || sessions.has(carId) || connecting.has(carId)) return;
  const transport = getTransport(c.source === 'mock');
  connecting.add(carId);
  useLive.getState().patch(carId, { status: 'connecting', error: null });
  try {
    if (!(await transport.canReconnect(c.deviceId))) {
      c = await pickAndBind(c);
      if (c.id !== carId) {
        useLive.getState().patch(carId, { status: 'offline' });
        connecting.delete(carId);
        return connectCar(c.id);
      }
    }
    await openSession(c);
  } catch (e) {
    const code = e instanceof TransportError ? e.code : 'connect-failed';
    useLive
      .getState()
      .patch(carId, { status: code === 'cancelled' ? 'offline' : 'failed', error: code });
    if (code !== 'cancelled') {
      useNotify
        .getState()
        .toast({ tone: 'danger', title: t('add.failedTitle'), body: t('add.failedBody') });
    }
  } finally {
    connecting.delete(carId);
  }
}

/** Used by the add-car flow: the device was just picked, connect it as this car. */
export async function openSession(c: SavedCar): Promise<void> {
  const transport = getTransport(c.source === 'mock');
  useLive.getState().patch(c.id, { status: 'connecting', error: null });
  const holder: { s?: Session } = {};
  const conn = await transport.connect(c.deviceId, {
    onData: (chunk) => {
      const s = holder.s;
      if (!s) return;
      for (const line of s.assembler.push(chunk)) onLine(s, line);
    },
    onDisconnect: () => handleLost(c.id),
  });
  const link = new CarLink(conn, {
    reversed: () => car(c.id)?.reversed ?? false,
    onEvent: (e) => logLinkEvent(c.id, e),
  });
  const s: Session = {
    carId: c.id,
    conn,
    link,
    assembler: new LineAssembler(),
    lifted: false,
    lastPersistAt: 0,
  };
  holder.s = s;
  sessions.set(c.id, s);
  applyBlock(s);
  link.stop(); // known state
  link.send({ kind: 'query' }); // capability handshake; current firmware ignores it
  useLive
    .getState()
    .patch(c.id, { status: 'connected', error: null, rxTimes: [], capabilities: null });
  useDevLog
    .getState()
    .add({ t: Date.now(), carId: c.id, dir: 'sys', text: `connected via ${transport.kind}` });
  haptic('tap');
  sound('connect');
  useNotify.getState().announce(t('events.connected', { name: c.name }));
}

export async function disconnectCar(carId: string): Promise<void> {
  const s = sessions.get(carId);
  if (!s) return;
  sessions.delete(carId);
  s.link.dispose(); // sends x
  await new Promise((r) => setTimeout(r, 60));
  await s.conn.disconnect().catch(() => undefined);
  useLive.getState().patch(carId, { status: 'offline', driving: false, telemetry: null });
  useDevLog.getState().add({ t: Date.now(), carId, dir: 'sys', text: 'disconnected by user' });
}

export function isConnected(carId: string): boolean {
  return sessions.has(carId);
}

export function connectedIds(): string[] {
  return [...sessions.keys()];
}

function speedFor(carId: string): number {
  return effectiveSpeed(car(carId)?.speed ?? 600, useSettings.getState().speedMode);
}

/** Hold a direction on these cars. Each car gets its own speed; lifted or locked cars stay stopped. */
export function hold(carIds: string[], dir: Direction): void {
  if (useLive.getState().locked) return;
  for (const id of carIds) sessions.get(id)?.link.hold(dir, speedFor(id));
}

/** Re-apply the held direction after a speed change, so the new speed takes effect while driving. */
export function refreshSpeed(carIds: string[], dir: Direction | null): void {
  if (dir) hold(carIds, dir);
}

export function release(carIds: string[]): void {
  for (const id of carIds) sessions.get(id)?.link.release();
}

export function pulse(carIds: string[], dir: Direction, kind: 'nudge' | 'spin'): void {
  if (useLive.getState().locked) return;
  const ms = kind === 'nudge' ? NUDGE_MS : SPIN_MS;
  for (const id of carIds) sessions.get(id)?.link.pulse(dir, speedFor(id), ms);
}

/** The most important function in the app. Never throws, never waits. */
export function stopAll(
  reason: 'button' | 'key' | 'shake' | 'hidden' | 'blur' | 'pagehide' = 'button',
): void {
  for (const s of sessions.values()) {
    try {
      s.link.stop();
    } catch {
      /* keep stopping the others */
    }
  }
  if (reason === 'button' || reason === 'key' || reason === 'shake') {
    haptic('stop');
    sound('stop');
    useNotify.getState().announce(t('events.stoppedAll'), true);
  }
}

export function setLocked(locked: boolean): void {
  useLive.getState().setLocked(locked);
  for (const s of sessions.values()) applyBlock(s);
  useNotify.getState().announce(t(locked ? 'events.locked' : 'events.unlocked'));
}

export function honk(carIds: string[]): void {
  for (const id of carIds) {
    if (useLive.getState().cars[id]?.capabilities?.hasHorn)
      sessions.get(id)?.link.send({ kind: 'honk' });
  }
}

export function locate(carIds: string[]): void {
  for (const id of carIds) {
    if (useLive.getState().cars[id]?.capabilities?.hasHorn)
      sessions.get(id)?.link.send({ kind: 'locate' });
  }
}

/** Dev options only. Validation happens in encodeCommand. */
export function sendRaw(carId: string, text: string): void {
  sessions.get(carId)?.link.send({ kind: 'raw', text });
}

export async function describeCar(carId: string): Promise<ServiceDescription[]> {
  const s = sessions.get(carId);
  if (!s) return [];
  return s.conn.describe();
}

/** Disconnect every car from one source (used when mock mode is switched off). */
export async function disconnectSource(source: 'real' | 'mock'): Promise<void> {
  const ids = useGarage
    .getState()
    .cars.filter((c) => c.source === source)
    .map((c) => c.id);
  await Promise.all(ids.map((id) => disconnectCar(id)));
}
