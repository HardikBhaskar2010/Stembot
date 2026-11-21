import { honk, locate, pulse, setLocked, step, stopAll, voiceMove } from '../control/fleet';
import { SPEED_STEP } from '../protocol/constants';
import { useGarage } from '../store/garage';
import { useSettings } from '../store/settings';
import type { VoiceAction } from './phrases';

/** A voice move is short on purpose: say it again to keep going. */
export const VOICE_MOVE_MS = 1000;

/** Carry out a recognised phrase on these cars, through the same command layer as the buttons. */
export function runVoiceAction(action: VoiceAction, targets: string[]): void {
  switch (action.type) {
    case 'stop':
      stopAll('button');
      return;
    case 'move':
      voiceMove(targets, action.dir, VOICE_MOVE_MS);
      return;
    case 'spin':
      pulse(targets, action.dir, 'spin');
      return;
    case 'step':
      step(targets, action.dir);
      return;
    case 'speed': {
      const g = useGarage.getState();
      for (const id of targets) {
        const c = g.cars.find((x) => x.id === id);
        if (c) g.updateCar(id, { speed: c.speed + action.delta * SPEED_STEP });
      }
      return;
    }
    case 'mode':
      useSettings.getState().set('speedMode', action.mode);
      return;
    case 'honk':
      honk(targets);
      return;
    case 'locate':
      locate(targets);
      return;
    case 'lock':
      setLocked(true);
      return;
  }
}
