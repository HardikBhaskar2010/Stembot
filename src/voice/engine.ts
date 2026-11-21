import { Capacitor } from '@capacitor/core';

/**
 * On-device speech recognition only (owner decision, Nov 22 2026): no audio may leave the device.
 * Uses the Web Speech API with `processLocally = true`, and only where the browser can confirm
 * local recognition through `SpeechRecognition.available()`. Anything else reports 'unavailable'
 * and the voice UI stays hidden. The native apps report 'unavailable' for now: the Capacitor
 * speech plugin has no option to force on-device recognition.
 */
export type VoiceAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export const VOICE_LANG = 'en-US';

interface RecognitionResultLike {
  isFinal: boolean;
  0?: { transcript: string };
}

interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface RecognitionCtor {
  new (): RecognitionLike;
  available?: (opts: { langs: string[]; processLocally: boolean }) => Promise<string>;
  install?: (opts: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
}

function ctor(): RecognitionCtor | null {
  const g = globalThis as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export async function voiceAvailability(): Promise<VoiceAvailability> {
  if (Capacitor.isNativePlatform()) return 'unavailable';
  const C = ctor();
  // Without available() the browser cannot promise on-device recognition: treat as unavailable.
  if (!C || typeof C.available !== 'function') return 'unavailable';
  try {
    const r = await C.available({ langs: [VOICE_LANG], processLocally: true });
    return r === 'available' || r === 'downloadable' || r === 'downloading' ? r : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Download the on-device English model (user-initiated). */
export async function installVoice(): Promise<boolean> {
  const C = ctor();
  if (!C || typeof C.install !== 'function') return false;
  try {
    return Boolean(await C.install({ langs: [VOICE_LANG], processLocally: true }));
  } catch {
    return false;
  }
}

export interface ListenHandlers {
  onPartial(text: string): void;
  onFinal(text: string): void;
  onError(code: string): void;
  onEnd(): void;
}

/** Start one push-to-talk session. Returns a function that stops listening. */
export function listen(h: ListenHandlers): () => void {
  const C = ctor();
  if (!C) {
    h.onError('unsupported');
    h.onEnd();
    return () => undefined;
  }
  const rec = new C();
  rec.lang = VOICE_LANG;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  rec.processLocally = true; // never send audio to a server
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const text = r?.[0]?.transcript ?? '';
      if (!text) continue;
      if (r?.isFinal) h.onFinal(text);
      else h.onPartial(text);
    }
  };
  rec.onerror = (e) => h.onError(e.error);
  rec.onend = () => h.onEnd();
  try {
    rec.start();
  } catch {
    h.onError('start-failed');
    h.onEnd();
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
}
