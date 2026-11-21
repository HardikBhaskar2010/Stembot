import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { t } from '../i18n/en';
import { haptic } from '../platform/feedback';
import type { Direction } from '../protocol/commands';

interface DriveInput {
  onHold: (dir: Direction) => void;
  onRelease: () => void;
  disabled?: boolean;
}

const DEADZONE = 0.22;

/**
 * Joystick for the left thumb. Four directions only (the firmware has w/s/a/d).
 * Any way the finger leaves (up, cancel, lost capture, unmount) releases = stop.
 */
export function Joystick({ onHold, onRelease, disabled }: DriveInput) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [dir, setDir] = useState<Direction | null>(null);
  const [dragging, setDragging] = useState(false);
  const active = useRef<number | null>(null);
  const current = useRef<Direction | null>(null);
  const releaseRef = useRef(onRelease);
  useEffect(() => {
    releaseRef.current = onRelease;
  });

  useEffect(
    () => () => {
      if (active.current !== null) releaseRef.current();
    },
    [],
  );

  const update = (e: PointerEvent<HTMLDivElement>) => {
    const el = base.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const radius = rect.width / 2;
    let x = (e.clientX - (rect.left + radius)) / radius;
    let y = (e.clientY - (rect.top + radius)) / radius;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    setKnob({ x, y });
    let next: Direction | null = null;
    if (Math.hypot(x, y) > DEADZONE) {
      next =
        Math.abs(y) >= Math.abs(x) ? (y < 0 ? 'forward' : 'backward') : x < 0 ? 'left' : 'right';
    }
    if (next !== current.current) {
      current.current = next;
      setDir(next);
      if (next) {
        haptic('tap');
        onHold(next);
      } else onRelease();
    }
  };

  const end = () => {
    if (active.current === null) return;
    active.current = null;
    current.current = null;
    setDragging(false);
    setKnob({ x: 0, y: 0 });
    setDir(null);
    onRelease();
  };

  return (
    <div
      className="joystick-wrap"
      role="application"
      aria-label={t('drive.padLabel')}
      aria-disabled={disabled}
    >
      <div
        ref={base}
        className={`joystick glass ${dir ? `joystick--${dir}` : ''} ${dragging ? 'joystick--active' : ''} ${disabled ? 'joystick--disabled' : ''}`}
        aria-hidden="true"
        onPointerDown={(e) => {
          if (disabled || active.current !== null) return;
          active.current = e.pointerId;
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => {
          if (e.pointerId === active.current) update(e);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      >
        <span className="joystick__cross" />
        <span
          className="joystick__knob glass glass--signal"
          style={{
            transform: `translate(calc(-50% + ${knob.x * 42}%), calc(-50% + ${knob.y * 42}%))`,
          }}
        />
      </div>
    </div>
  );
}

const PAD: {
  dir: Direction;
  icon: typeof ArrowUp;
  key: 'forward' | 'backward' | 'left' | 'right';
}[] = [
  { dir: 'forward', icon: ArrowUp, key: 'forward' },
  { dir: 'left', icon: ArrowLeft, key: 'left' },
  { dir: 'right', icon: ArrowRight, key: 'right' },
  { dir: 'backward', icon: ArrowDown, key: 'backward' },
];

/** Arrow pad: four hold buttons. Keyboard: Enter holds while pressed. */
export function ArrowPad({ onHold, onRelease, disabled }: DriveInput) {
  const [pressed, setPressed] = useState<Direction | null>(null);
  const pressedRef = useRef<Direction | null>(null);
  const releaseRef = useRef(onRelease);
  useEffect(() => {
    releaseRef.current = onRelease;
  });
  useEffect(
    () => () => {
      if (pressedRef.current) releaseRef.current();
    },
    [],
  );

  const down = (dir: Direction) => {
    if (disabled) return;
    pressedRef.current = dir;
    setPressed(dir);
    haptic('tap');
    onHold(dir);
  };
  const up = () => {
    if (!pressedRef.current) return;
    pressedRef.current = null;
    setPressed(null);
    onRelease();
  };

  return (
    <div className="arrowpad" role="group" aria-label={t('drive.padLabel')}>
      {PAD.map(({ dir, icon: Icon, key }) => (
        <button
          key={dir}
          type="button"
          className={`arrowpad__btn arrowpad__btn--${dir} glass glass-i`}
          data-pressed={pressed === dir}
          aria-label={`${t(`drive.${key}`)}, ${t('drive.holdSuffix')}`}
          disabled={disabled}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            down(dir);
          }}
          onPointerUp={up}
          onPointerCancel={up}
          onLostPointerCapture={up}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.repeat) {
              e.preventDefault();
              down(dir);
            }
          }}
          onKeyUp={(e: KeyboardEvent) => {
            if (e.key === 'Enter') up();
          }}
          onBlur={up}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Icon size={30} strokeWidth={2.25} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
