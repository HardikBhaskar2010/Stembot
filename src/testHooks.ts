import { useSettings } from './store/settings';
import { getMockTransport } from './transport';
import { runVoiceAction } from './voice/dispatch';
import { matchVoice } from './voice/phrases';

/**
 * Lets the Playwright smoke test (and a developer in the console) drive the mock cars:
 * enable mock mode with `?mock=1`, then read what each fake car received.
 * Only the mock transport is exposed; it cannot reach real Bluetooth.
 */
export function exposeTestHooks(): void {
  const params = new URLSearchParams(location.search);
  if (params.get('mock') === '1') {
    useSettings.getState().set('devOptions', true);
    useSettings.getState().set('mockMode', true);
  }
  if (!useSettings.getState().mockMode) return;
  const mock = getMockTransport();
  (window as unknown as { __stembotMock: unknown }).__stembotMock = {
    motionOf: (id: string) => mock.motionOf(id),
    received: (id: string) => [...mock.receivedLines(id)],
    setLifted: (id: string, v: boolean) => mock.setLifted(id, v),
    drop: (id: string) => mock.dropConnection(id),
    firmware: (id: string) => mock.firmwareStateOf(id),
    clap: (id: string, n: 1 | 2 | 3) => mock.clap(id, n),
    calibrate: (id: string) => mock.calibrateCompass(id),
    /** Feed a transcript through the voice matcher and command layer (no microphone needed). */
    say: (text: string, targets: string[]) => {
      const action = matchVoice(text);
      if (action) runVoiceAction(action, targets);
      return action;
    },
    nextPick: (mode: 'auto' | 'cancel' | 'bluetooth-off' | 'permission-denied') => {
      mock.nextPick = mode;
    },
  };
}
