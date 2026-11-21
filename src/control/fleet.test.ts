// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGarage, type SavedCar } from '../store/garage';
import { liftBlocks, useLive } from '../store/live';
import { useNotify } from '../store/notify';
import { useSettings } from '../store/settings';
import { getMockTransport } from '../transport';
import {
  connectCar,
  disconnectCar,
  hold,
  release,
  setCarSounds,
  setClapMode,
  setNorthHere,
  setObstacleStop,
  setStopWhenLifted,
  stopAll,
} from './fleet';

/**
 * Per-car lift logic and firmware v2 settings, driven through the real fleet code against
 * MockTransport (which behaves like firmware v2: lift-stop default off, settings reset on
 * disconnect, air=1 reported whenever the car is lifted).
 */

const CAR_A = 'mock-zogat'; // has ultrasonic, firmware v2
const CAR_B = 'mock-gizop'; // has ultrasonic, firmware v2
const mock = getMockTransport();

function addMockCar(deviceId: string, name: string): SavedCar {
  return useGarage.getState().addCar({
    name,
    color: 'cyan',
    deviceId,
    deviceName: deviceId,
    source: 'mock',
  });
}

/** Lines the fake car received since `from`. */
function linesSince(deviceId: string, from: number): string[] {
  return mock.receivedLines(deviceId).slice(from);
}

async function connect(car: SavedCar) {
  const p = connectCar(car.id);
  await vi.advanceTimersByTimeAsync(400); // mock connect delay
  await p;
}

beforeEach(() => {
  vi.useFakeTimers();
  useGarage.setState({ cars: [], lastDrivenId: null });
  useLive.setState({ cars: {}, locked: false });
  useNotify.setState({ toasts: [] });
  useSettings.getState().set('liftOffNoticeSeen', false);
});

afterEach(async () => {
  for (const c of useGarage.getState().cars) {
    mock.setLifted(c.deviceId, false);
    const p = disconnectCar(c.id);
    await vi.advanceTimersByTimeAsync(100);
    await p;
  }
  vi.useRealTimers();
});

describe('firmware v2 settings on connect', () => {
  it('sends x first, then i0 about 300 ms later; o only when the user set it', async () => {
    const car = addMockCar(CAR_A, 'Rocket');
    const from = mock.receivedLines(CAR_A).length;
    await connect(car);
    expect(linesSince(CAR_A, from).slice(0, 2)).toEqual(['x', '?']);
    expect(linesSince(CAR_A, from)).not.toContain('i0');

    await vi.advanceTimersByTimeAsync(320);
    const lines = linesSince(CAR_A, from);
    expect(lines).toContain('i0');
    expect(lines.indexOf('x')).toBeLessThan(lines.indexOf('i0'));
    expect(lines.some((l) => l.startsWith('o'))).toBe(false);

    setObstacleStop(car.id, 30);
    await vi.advanceTimersByTimeAsync(50);
    expect(linesSince(CAR_A, from).at(-1)).toBe('o30');
    expect(mock.firmwareStateOf(CAR_A).obstacleCm).toBe(30);
    expect(useLive.getState().cars[car.id]?.fw.obstacleCm).toBe(30);

    setObstacleStop(car.id, 0);
    await vi.advanceTimersByTimeAsync(50);
    expect(linesSince(CAR_A, from).at(-1)).toBe('o0');
    expect(mock.firmwareStateOf(CAR_A).obstacleCm).toBe(0);
  });

  it('records the raw C: reply and the capabilities on the car', async () => {
    const car = addMockCar(CAR_A, 'Rocket');
    await connect(car);
    await vi.advanceTimersByTimeAsync(100);
    expect(useLive.getState().cars[car.id]?.capsRaw).toBe('C:2.1,1,1,1');
    expect(useGarage.getState().cars[0]?.caps).toEqual({
      version: '2.1',
      hasUltrasonic: true,
      hasHorn: true,
      hasCompass: true,
    });
  });

  it('re-sends i1 and o after a reconnect, after the first x (car settings reset on link loss)', async () => {
    const car = addMockCar(CAR_A, 'Rocket');
    setStopWhenLifted(car.id, true);
    setObstacleStop(car.id, 20);
    await connect(car);
    await vi.advanceTimersByTimeAsync(320);
    expect(mock.firmwareStateOf(CAR_A)).toEqual({ liftStop: true, obstacleCm: 20 });

    mock.dropConnection(CAR_A);
    expect(mock.firmwareStateOf(CAR_A)).toEqual({ liftStop: false, obstacleCm: 0 });
    expect(useLive.getState().cars[car.id]?.fw.liftStop).toBeNull();

    const from = mock.receivedLines(CAR_A).length;
    await connect(car);
    await vi.advanceTimersByTimeAsync(320);
    const lines = linesSince(CAR_A, from);
    expect(lines[0]).toBe('x');
    expect(lines.indexOf('i1')).toBeGreaterThan(0);
    expect(lines).toContain('o20');
    expect(mock.firmwareStateOf(CAR_A)).toEqual({ liftStop: true, obstacleCm: 20 });
  });
});

describe('per-car lift logic', () => {
  it('Stop when lifted OFF (default): a lifted car keeps driving and is not blocked', async () => {
    const car = addMockCar(CAR_A, 'Rocket');
    await connect(car);
    await vi.advanceTimersByTimeAsync(320);
    hold([car.id], 'forward');
    await vi.advanceTimersByTimeAsync(200);
    expect(mock.motionOf(CAR_A)).toBe('w');

    const from = mock.receivedLines(CAR_A).length;
    mock.setLifted(CAR_A, true);
    await vi.advanceTimersByTimeAsync(500); // several telemetry lines with air=1
    const live = useLive.getState().cars[car.id];
    expect(live?.telemetry?.lifted).toBe(true);
    expect(liftBlocks(live!, false)).toBe(false);
    expect(mock.motionOf(CAR_A)).toBe('w');
    const after = linesSince(CAR_A, from);
    expect(after.length).toBeGreaterThan(3);
    expect(after.every((l) => l.startsWith('w'))).toBe(true); // no x sent because of the lift

    // STOP still works on a lifted, drivable car
    stopAll('button');
    await vi.advanceTimersByTimeAsync(50);
    expect(linesSince(CAR_A, from).at(-1)).toBe('x');
    expect(mock.motionOf(CAR_A)).toBe('x');
  });

  it('Stop when lifted ON: the app sends x on lift and refuses to drive until put down', async () => {
    const car = addMockCar(CAR_A, 'Rocket');
    setStopWhenLifted(car.id, true);
    await connect(car);
    await vi.advanceTimersByTimeAsync(320);
    expect(mock.firmwareStateOf(CAR_A).liftStop).toBe(true);

    hold([car.id], 'forward');
    await vi.advanceTimersByTimeAsync(200);
    expect(mock.motionOf(CAR_A)).toBe('w');

    mock.setLifted(CAR_A, true);
    await vi.advanceTimersByTimeAsync(400);
    expect(mock.receivedLines(CAR_A).at(-1)).toBe('x');
    expect(mock.motionOf(CAR_A)).toBe('x');
    expect(liftBlocks(useLive.getState().cars[car.id]!, true)).toBe(true);

    const from = mock.receivedLines(CAR_A).length;
    hold([car.id], 'forward');
    await vi.advanceTimersByTimeAsync(300);
    expect(linesSince(CAR_A, from).some((l) => l.startsWith('w'))).toBe(false);

    mock.setLifted(CAR_A, false);
    await vi.advanceTimersByTimeAsync(400);
    hold([car.id], 'backward');
    await vi.advanceTimersByTimeAsync(200);
    expect(mock.motionOf(CAR_A)).toBe('s');
    release([car.id]);
  });

  it('turning it on while lifted stops the car right away', async () => {
    const car = addMockCar(CAR_A, 'Rocket');
    await connect(car);
    await vi.advanceTimersByTimeAsync(320);
    hold([car.id], 'forward');
    mock.setLifted(CAR_A, true);
    await vi.advanceTimersByTimeAsync(400);
    expect(mock.motionOf(CAR_A)).toBe('w');

    setStopWhenLifted(car.id, true);
    await vi.advanceTimersByTimeAsync(100);
    const lines = mock.receivedLines(CAR_A);
    expect(lines).toContain('i1');
    // The stop is sent (ahead of i1 if both are waiting) and nothing drives after it.
    const lastStop = lines.lastIndexOf('x');
    expect(lastStop).toBeGreaterThan(-1);
    expect(lines.slice(lastStop).some((l) => /^[wsad]/.test(l))).toBe(false);
    expect(mock.motionOf(CAR_A)).toBe('x');
  });

  it('group: one car lifting never affects another car', async () => {
    const a = addMockCar(CAR_A, 'Rocket');
    const b = addMockCar(CAR_B, 'Comet');
    setStopWhenLifted(a.id, true); // A stops when lifted, B does not
    await connect(a);
    await connect(b);
    await vi.advanceTimersByTimeAsync(320);

    hold([a.id, b.id], 'forward');
    await vi.advanceTimersByTimeAsync(200);
    expect(mock.motionOf(CAR_A)).toBe('w');
    expect(mock.motionOf(CAR_B)).toBe('w');

    // A is lifted: A stops, B keeps going
    mock.setLifted(CAR_A, true);
    await vi.advanceTimersByTimeAsync(500);
    expect(mock.motionOf(CAR_A)).toBe('x');
    expect(mock.motionOf(CAR_B)).toBe('w');

    // B is lifted too (its setting is off): B keeps driving, A is unaffected
    mock.setLifted(CAR_B, true);
    await vi.advanceTimersByTimeAsync(500);
    expect(mock.motionOf(CAR_B)).toBe('w');
    expect(mock.motionOf(CAR_A)).toBe('x');

    release([a.id, b.id]);
    await vi.advanceTimersByTimeAsync(150); // x waits behind one in-flight keep-alive (30 ms mock latency)
    expect(mock.motionOf(CAR_B)).toBe('x');
  });
});

describe('one-time notice', () => {
  it('shows a warning the first time Stop when lifted is turned off, and only once', () => {
    const car = addMockCar(CAR_A, 'Rocket');
    setStopWhenLifted(car.id, true);
    expect(useNotify.getState().toasts).toHaveLength(0);

    setStopWhenLifted(car.id, false);
    const toasts = useNotify.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.tone).toBe('warning');
    expect(toasts[0]?.body).toMatch(/keeps spinning its wheels/);
    expect(useSettings.getState().liftOffNoticeSeen).toBe(true);

    useNotify.setState({ toasts: [] });
    setStopWhenLifted(car.id, true);
    setStopWhenLifted(car.id, false);
    expect(useNotify.getState().toasts).toHaveLength(0);
  });

  it('the setting is persisted per car', () => {
    const a = addMockCar(CAR_A, 'Rocket');
    const b = addMockCar(CAR_B, 'Comet');
    setStopWhenLifted(a.id, true);
    const cars = useGarage.getState().cars;
    expect(cars.find((c) => c.id === a.id)?.stopWhenLifted).toBe(true);
    expect(cars.find((c) => c.id === b.id)?.stopWhenLifted).toBe(false);
    const stored = JSON.parse(localStorage.getItem('stembot.garage.v1') ?? '{}') as {
      state: { cars: SavedCar[] };
    };
    expect(stored.state.cars.find((c) => c.id === a.id)?.stopWhenLifted).toBe(true);
  });
});

describe('firmware v2.1 settings', () => {
  it('sends m1 after connect by default, k1 only when clap mode is on', async () => {
    const car = addMockCar(CAR_A, 'Rocket');
    const from = mock.receivedLines(CAR_A).length;
    await connect(car);
    await vi.advanceTimersByTimeAsync(320);
    const lines = linesSince(CAR_A, from);
    expect(lines).toContain('m1');
    expect(lines).not.toContain('k1');
    expect(lines.indexOf('x')).toBeLessThan(lines.indexOf('m1'));
  });

  it('re-sends m0 and k1 after a reconnect when the user set them', async () => {
    const car = addMockCar(CAR_A, 'Rocket');
    setCarSounds(false);
    setClapMode(car.id, true);
    await connect(car);
    await vi.advanceTimersByTimeAsync(320);
    mock.dropConnection(CAR_A);
    const from = mock.receivedLines(CAR_A).length;
    await connect(car);
    await vi.advanceTimersByTimeAsync(320);
    const lines = linesSince(CAR_A, from);
    expect(lines).toContain('m0');
    expect(lines).toContain('k1');
    expect(useLive.getState().cars[car.id]?.fw.clapMode).toBe(true);
    setCarSounds(true);
  });

  it('a clap on the car starts a bounded move and is reported to the app', async () => {
    const car = addMockCar(CAR_A, 'Rocket');
    setClapMode(car.id, true);
    await connect(car);
    await vi.advanceTimersByTimeAsync(320);
    expect(mock.clap(CAR_A, 1)).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    expect(mock.motionOf(CAR_A)).toBe('w');
    expect(useLive.getState().cars[car.id]?.lastClap?.claps).toBe(1);
    // the app's STOP still wins over a clap move
    stopAll('button');
    await vi.advanceTimersByTimeAsync(200);
    expect(mock.motionOf(CAR_A)).toBe('x');
  });

  it('reports heading from M lines and sets a per-car north offset', async () => {
    const car = addMockCar(CAR_A, 'Rocket');
    await connect(car);
    await vi.advanceTimersByTimeAsync(400);
    const heading = useLive.getState().cars[car.id]?.motion?.headingDeg;
    expect(typeof heading).toBe('number');
    expect(setNorthHere(car.id)).toBe(true);
    expect(useGarage.getState().cars[0]?.headingOffset).toBe(heading);
  });

  it('an uncalibrated compass reports no heading and cannot set north', async () => {
    const car = addMockCar(CAR_B, 'Comet'); // mock-gizop starts uncalibrated
    await connect(car);
    await vi.advanceTimersByTimeAsync(400);
    expect(useLive.getState().cars[car.id]?.motion?.headingDeg).toBeNull();
    expect(setNorthHere(car.id)).toBe(false);
    mock.calibrateCompass(CAR_B);
    await vi.advanceTimersByTimeAsync(400);
    expect(typeof useLive.getState().cars[car.id]?.motion?.headingDeg).toBe('number');
  });
});
