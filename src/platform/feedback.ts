import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { useSettings } from '../store/settings';

/** Haptics: native on Capacitor, navigator.vibrate on the web (where supported). Never throws. */
export function haptic(kind: 'tap' | 'press' | 'stop' | 'warning'): void {
  if (!useSettings.getState().haptics) return;
  const run = async () => {
    if (kind === 'tap') await Haptics.impact({ style: ImpactStyle.Light });
    else if (kind === 'press') await Haptics.impact({ style: ImpactStyle.Medium });
    else if (kind === 'stop') await Haptics.impact({ style: ImpactStyle.Heavy });
    else await Haptics.notification({ type: NotificationType.Warning });
  };
  run().catch(() => undefined);
}

let ctx: AudioContext | null = null;

/** Short synthesized tones; no audio files, no network. */
export function sound(kind: 'connect' | 'stop' | 'lost'): void {
  if (!useSettings.getState().sound) return;
  try {
    ctx ??= new AudioContext();
    const tones: Record<typeof kind, [number, number][]> = {
      connect: [
        [660, 0.07],
        [990, 0.09],
      ],
      stop: [[330, 0.12]],
      lost: [
        [520, 0.1],
        [260, 0.16],
      ],
    };
    let t = ctx.currentTime;
    for (const [freq, dur] of tones[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur;
    }
  } catch {
    /* audio not available */
  }
}
