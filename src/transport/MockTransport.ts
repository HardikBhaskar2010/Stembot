import {
  CAR_WATCHDOG_MS,
  NAME_PREFIX,
  SPEED_DEFAULT,
  TELEMETRY_PERIOD_MS,
} from '../protocol/constants';
import {
  TransportError,
  type CarConnection,
  type CarTransport,
  type ConnectionHandlers,
  type DeviceInfo,
  type ServiceDescription,
  type SupportResult,
} from './types';

/**
 * Fake cars that behave like the real firmware: 250 ms watchdog, lift stop, telemetry every 150 ms.
 * For developing and testing without hardware. Never shipped as "real" anywhere: the UI labels it.
 */
export interface MockCarProfile {
  id: string;
  name: string;
  hasUltrasonic: boolean;
  /** Firmware v2.1: answers `?`, supports i/o/m/k, sends M: lines. false = old firmware. */
  newFirmware: boolean;
  /** Compass state at connect: calibrated (sends a heading) or not yet (sends -1). */
  compassCalibrated: boolean;
  /** Simulated write latency. */
  latencyMs: number;
}

export const MOCK_CARS: MockCarProfile[] = [
  {
    id: 'mock-zogat',
    name: `${NAME_PREFIX} [zogat]`,
    hasUltrasonic: true,
    newFirmware: true,
    compassCalibrated: true,
    latencyMs: 8,
  },
  {
    id: 'mock-pevit',
    name: `${NAME_PREFIX} [pevit]`,
    hasUltrasonic: false,
    newFirmware: true,
    compassCalibrated: true,
    latencyMs: 15,
  },
  {
    id: 'mock-tuvog',
    name: `${NAME_PREFIX} [tuvog]`,
    hasUltrasonic: true,
    newFirmware: false,
    compassCalibrated: false,
    latencyMs: 140,
  },
  {
    id: 'mock-gizop',
    name: `${NAME_PREFIX} [gizop]`,
    hasUltrasonic: true,
    newFirmware: true,
    compassCalibrated: false,
    latencyMs: 30,
  },
];

interface SimState {
  motion: 'w' | 's' | 'a' | 'd' | 'x';
  speed: number;
  lastDriveAt: number;
  distance: number;
  lifted: boolean;
  handlers: ConnectionHandlers | null;
  timer: ReturnType<typeof setInterval> | null;
  connected: boolean;
  rxLog: string[];
  /** Firmware v2 `i`: stop while lifted. Default off, resets on disconnect. */
  liftStop: boolean;
  heading: number;
  compassReady: boolean;
  soundOn: boolean;
  clapMode: boolean;
  /** A move the fake car makes by itself after claps. */
  autoCmd: 'w' | 'd' | 'x';
  autoUntil: number;
  bumped: boolean;
  /** Firmware v2 `o`: forward obstacle stop in cm, 0 = off. Resets on disconnect. */
  obstacleCm: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class MockTransport implements CarTransport {
  readonly kind = 'mock' as const;
  private readonly sims = new Map<string, SimState>();
  private pickIndex = 0;
  /** Test hook: what the next requestDevice() does. */
  nextPick: 'auto' | 'cancel' | 'bluetooth-off' | 'permission-denied' = 'auto';
  bluetoothOn = true;

  async checkSupport(): Promise<SupportResult> {
    return this.bluetoothOn ? { ok: true } : { ok: false, reason: 'bluetooth-off' };
  }

  async requestDevice(): Promise<DeviceInfo> {
    await delay(250);
    const mode = this.nextPick;
    this.nextPick = 'auto';
    if (mode === 'cancel')
      throw new TransportError('cancelled', 'User cancelled the requestDevice() chooser.');
    if (mode === 'bluetooth-off' || !this.bluetoothOn) throw new TransportError('bluetooth-off');
    if (mode === 'permission-denied') throw new TransportError('permission-denied');
    const car = MOCK_CARS[this.pickIndex % MOCK_CARS.length];
    if (!car) throw new TransportError('not-found');
    this.pickIndex += 1;
    return { id: car.id, name: car.name };
  }

  async canReconnect(deviceId: string): Promise<boolean> {
    return MOCK_CARS.some((c) => c.id === deviceId);
  }

  async connect(deviceId: string, handlers: ConnectionHandlers): Promise<CarConnection> {
    const profile = MOCK_CARS.find((c) => c.id === deviceId);
    if (!profile) throw new TransportError('not-found');
    await delay(350);
    const sim = this.sim(deviceId);
    sim.handlers = handlers;
    sim.connected = true;
    if (profile.compassCalibrated) sim.compassReady = true;
    sim.motion = 'x';
    if (sim.timer) clearInterval(sim.timer);
    sim.timer = setInterval(() => this.tick(profile, sim), TELEMETRY_PERIOD_MS);

    return {
      device: { id: profile.id, name: profile.name },
      write: async (data: Uint8Array) => {
        await delay(profile.latencyMs);
        if (!sim.connected) throw new TransportError('write-failed', 'Not connected');
        this.receive(profile, sim, decoder.decode(data));
      },
      disconnect: async () => {
        this.teardown(sim);
      },
      describe: async (): Promise<ServiceDescription[]> => [
        {
          uuid: '00001800-0000-1000-8000-00805f9b34fb',
          characteristics: [{ uuid: '00002a00-0000-1000-8000-00805f9b34fb', properties: ['read'] }],
        },
        {
          uuid: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
          characteristics: [
            { uuid: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', properties: ['indicate'] },
            {
              uuid: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
              properties: ['write', 'writeWithoutResponse'],
            },
          ],
        },
      ],
    };
  }

  /** Dev/test hook: pick the car up or put it down. */
  setLifted(deviceId: string, lifted: boolean): void {
    const sim = this.sims.get(deviceId);
    if (!sim) return;
    sim.lifted = lifted;
    // Firmware v2: a lifted car only stops when lift-stop (`i1`) is on.
    if (lifted && sim.liftStop) sim.motion = 'x';
  }

  /** Test hook: firmware v2 settings as the fake car currently has them. */
  firmwareStateOf(deviceId: string): { liftStop: boolean; obstacleCm: number } {
    const sim = this.sims.get(deviceId);
    return { liftStop: sim?.liftStop ?? false, obstacleCm: sim?.obstacleCm ?? 0 };
  }

  /** Dev/test hook: simulate the car dropping off (out of range, flat battery). */
  dropConnection(deviceId: string): void {
    const sim = this.sims.get(deviceId);
    if (!sim?.connected) return;
    const h = sim.handlers;
    this.teardown(sim);
    h?.onDisconnect();
  }

  /** Dev/test hook: what the car is doing right now. */
  motionOf(deviceId: string): string {
    return this.sims.get(deviceId)?.motion ?? 'x';
  }

  receivedLines(deviceId: string): readonly string[] {
    return this.sims.get(deviceId)?.rxLog ?? [];
  }

  private sim(id: string): SimState {
    let s = this.sims.get(id);
    if (!s) {
      s = {
        motion: 'x',
        speed: SPEED_DEFAULT,
        lastDriveAt: 0,
        distance: 80 + Math.random() * 60,
        lifted: false,
        handlers: null,
        timer: null,
        connected: false,
        rxLog: [],
        liftStop: false,
        obstacleCm: 0,
        heading: 30 + Math.random() * 300,
        compassReady: false,
        soundOn: true,
        clapMode: false,
        autoCmd: 'x',
        autoUntil: 0,
        bumped: false,
      };
      this.sims.set(id, s);
    }
    return s;
  }

  private teardown(sim: SimState) {
    sim.connected = false;
    sim.motion = 'x'; // the car stops by itself on link loss
    sim.liftStop = false; // firmware v2 settings reset on link loss
    sim.obstacleCm = 0;
    sim.soundOn = true;
    sim.clapMode = false;
    sim.autoCmd = 'x';
    if (sim.timer) clearInterval(sim.timer);
    sim.timer = null;
    sim.handlers = null;
  }

  private receive(profile: MockCarProfile, sim: SimState, text: string) {
    for (const line of text.split('\n')) {
      if (!line) continue;
      sim.rxLog.push(line);
      if (sim.rxLog.length > 200) sim.rxLog.shift();
      const letter = line[0];
      const arg = Number(line.slice(1));
      if (letter === 'x' || letter === ' ') {
        sim.motion = 'x';
        sim.autoCmd = 'x';
      } else if (letter === 'w' || letter === 's' || letter === 'a' || letter === 'd') {
        if (sim.lifted && sim.liftStop) continue; // lift-stop on: lifted cars ignore drive letters
        sim.motion = letter;
        sim.autoCmd = 'x'; // the app takes over from a clap move
        if (Number.isFinite(arg) && arg > 0) sim.speed = arg;
        sim.lastDriveAt = performance.now();
      } else if (letter === 'q') sim.speed = Math.max(200, sim.speed - 100);
      else if (letter === 'e') sim.speed = Math.min(1023, sim.speed + 100);
      else if (letter === 'i' && profile.newFirmware) {
        sim.liftStop = arg === 1;
        if (sim.liftStop && sim.lifted) sim.motion = 'x';
      } else if (letter === 'o' && profile.newFirmware) {
        sim.obstacleCm = Number.isInteger(arg) && arg >= 10 && arg <= 100 ? arg : 0;
      } else if (letter === 'm' && profile.newFirmware) {
        sim.soundOn = arg === 1;
      } else if (letter === 'k' && profile.newFirmware) {
        sim.clapMode = arg === 1;
        sim.autoCmd = 'x';
      } else if (letter === '?' && profile.newFirmware) {
        this.send(sim, `C:2.1,${profile.hasUltrasonic ? 1 : 0},1,1\n`);
      }
    }
  }

  private tick(profile: MockCarProfile, sim: SimState) {
    if (!sim.connected) return;
    // Firmware watchdog: no drive letter for 250 ms -> stop.
    if (sim.motion !== 'x' && performance.now() - sim.lastDriveAt > CAR_WATCHDOG_MS)
      sim.motion = 'x';
    if (sim.lifted && sim.liftStop) sim.motion = 'x';
    // Clap moves: bounded, end when lifted, and the app's commands win.
    if (sim.autoCmd !== 'x' && (performance.now() > sim.autoUntil || sim.lifted)) sim.autoCmd = 'x';
    if (sim.motion === 'x' && sim.autoCmd !== 'x') sim.motion = sim.autoCmd;
    if (sim.motion === 'a') sim.heading -= (sim.speed / 1023) * 14;
    if (sim.motion === 'd') sim.heading += (sim.speed / 1023) * 14;
    sim.heading = ((sim.heading % 360) + 360) % 360;
    if (
      sim.motion === 'w' &&
      sim.obstacleCm > 0 &&
      profile.hasUltrasonic &&
      sim.distance < sim.obstacleCm
    )
      sim.motion = 'x';
    const step = (sim.speed / 1023) * 6;
    if (sim.motion === 'w') sim.distance -= step;
    if (sim.motion === 's') sim.distance += step;
    if (sim.motion === 'a' || sim.motion === 'd') sim.distance += (Math.random() - 0.5) * 30;
    if (sim.distance < 6) {
      sim.distance = 140 + Math.random() * 80; // "turned away from the wall"
      if (sim.motion === 'w') sim.bumped = true; // and felt the hit
    }
    sim.distance = Math.min(260, Math.max(4, sim.distance + (Math.random() - 0.5) * 1.5));
    const cm = profile.hasUltrasonic ? Math.round(sim.distance) : 0;
    const ir = sim.lifted ? 1 : 0;
    const line = `D:${cm},${ir},${ir},${sim.lifted ? 1 : 0}\n`;
    // Sometimes split a line across two chunks, like real BLE notifications can.
    if (Math.random() < 0.15) {
      this.send(sim, line.slice(0, 4));
      this.send(sim, line.slice(4));
    } else this.send(sim, line);
    if (profile.newFirmware) {
      const h = sim.compassReady ? Math.round(sim.heading) % 360 : -1;
      const pitch = Math.round((Math.random() - 0.5) * 4);
      const roll = Math.round((Math.random() - 0.5) * 4);
      this.send(sim, `M:${h},${pitch},${roll},${sim.bumped ? 1 : 0}\n`);
      sim.bumped = false;
    }
  }

  /** Test/dev hook: someone claps n times near the fake car (it must be in clap mode). */
  clap(deviceId: string, n: 1 | 2 | 3): boolean {
    const sim = this.sims.get(deviceId);
    if (!sim?.connected || !sim.clapMode || sim.motion !== 'x') return false;
    this.send(sim, `K:${n}\n`);
    sim.autoCmd = n === 1 ? 'w' : 'd';
    sim.autoUntil = performance.now() + (n === 1 ? 1000 : n === 2 ? 450 : 900);
    return true;
  }

  /** Test/dev hook: press button A on the fake car (compass calibrated). */
  calibrateCompass(deviceId: string): void {
    const sim = this.sims.get(deviceId);
    if (sim) sim.compassReady = true;
  }

  private send(sim: SimState, text: string) {
    sim.handlers?.onData(encoder.encode(text));
  }
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
