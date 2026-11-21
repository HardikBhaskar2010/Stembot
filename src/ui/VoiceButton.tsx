import { Mic } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { stopAll } from '../control/fleet';
import { t } from '../i18n/en';
import { haptic } from '../platform/feedback';
import { useNotify } from '../store/notify';
import { useSettings } from '../store/settings';
import { runVoiceAction } from '../voice/dispatch';
import { listen, voiceAvailability, type VoiceAvailability } from '../voice/engine';
import { hasStopWord, matchVoice } from '../voice/phrases';

/** Shared availability check (one probe per page load). */
let availability: Promise<VoiceAvailability> | null = null;
export function useVoiceAvailability(): VoiceAvailability | 'checking' {
  const [state, setState] = useState<VoiceAvailability | 'checking'>('checking');
  useEffect(() => {
    let alive = true;
    availability ??= voiceAvailability();
    void availability.then((a) => alive && setState(a));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export function resetVoiceAvailability(): void {
  availability = null;
}

/**
 * Push-to-talk: hold to listen, release to act. "Stop" is acted on from the partial
 * transcript, before the phrase is finished. Voice is a convenience, never the safety stop.
 */
export function VoiceButton({ targets }: { targets: string[] }) {
  const enabled = useSettings((s) => s.voice);
  // Only touch the speech APIs once the user has turned voice on in Settings.
  if (!enabled) return null;
  return <VoiceButtonInner targets={targets} />;
}

function VoiceButtonInner({ targets }: { targets: string[] }) {
  const avail = useVoiceAvailability();
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string>('');
  const stopRef = useRef<(() => void) | null>(null);
  const stoppedThisTurn = useRef(false);
  const targetsRef = useRef(targets);
  useEffect(() => {
    targetsRef.current = targets;
  });
  useEffect(() => () => stopRef.current?.(), []);

  if (avail !== 'available') return null;

  const start = () => {
    if (stopRef.current) return;
    haptic('tap');
    stoppedThisTurn.current = false;
    setListening(true);
    setStatus(t('voice.listening'));
    stopRef.current = listen({
      onPartial: (text) => {
        if (!stoppedThisTurn.current && hasStopWord(text)) {
          stoppedThisTurn.current = true;
          stopAll('button');
        }
        setStatus(t('voice.heard', { text }));
      },
      onFinal: (text) => {
        const action = matchVoice(text);
        if (!action) {
          setStatus(t('voice.notUnderstood', { text }));
          return;
        }
        if (action.type === 'stop' && stoppedThisTurn.current) {
          setStatus(t('voice.heard', { text }));
          return;
        }
        runVoiceAction(action, targetsRef.current);
        setStatus(t('voice.heard', { text }));
      },
      onError: (code) => {
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          useSettings.getState().set('voice', false);
          useNotify.getState().toast({ tone: 'warning', title: t('voice.micDenied') });
        }
      },
      onEnd: () => {
        stopRef.current = null;
        setListening(false);
      },
    });
  };
  const end = () => {
    stopRef.current?.();
  };

  return (
    <div className="voice">
      <button
        type="button"
        className={`btn glass glass-i voice__btn ${listening ? 'voice__btn--on' : ''}`}
        aria-pressed={listening}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start();
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.repeat) start();
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter') end();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Mic size={18} aria-hidden="true" />
        {listening ? t('voice.listening') : t('voice.hold')}
      </button>
      <p className="voice__status" role="status" aria-live="polite">
        {status || t('voice.stopNote')}
      </p>
    </div>
  );
}
