import { useState } from 'react';
import { t } from '../i18n/en';
import { TELEMETRY_STALE_MS } from '../protocol/constants';
import { hasCompass, type SavedCar } from '../store/garage';
import type { LiveCar } from '../store/live';

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Heading after the car's "north" offset, 0..359. */
export function relativeHeading(raw: number, offset: number): number {
  return (((Math.round(raw) - Math.round(offset)) % 360) + 360) % 360;
}

export function cardinal(deg: number): (typeof POINTS)[number] {
  return POINTS[Math.round(deg / 45) % 8] ?? 'N';
}

/**
 * Small compass in the radar card. The arrow is the car's direction against north (top).
 * It takes the short way round when crossing north (359 -> 1 turns 2 degrees, not 358).
 */
/**
 * Unwrapped needle angle: follows `deg` but always by the shortest turn, so a CSS transition
 * never spins the long way round (adjust-state-on-prop-change pattern, no effects or refs).
 */
function useShortestAngle(deg: number | null): number | null {
  const [state, setState] = useState<{ deg: number | null; angle: number | null }>({
    deg,
    angle: deg,
  });
  if (deg !== state.deg) {
    let angle = deg;
    if (deg !== null && state.angle !== null) {
      const delta = ((((deg - state.angle) % 360) + 540) % 360) - 180;
      angle = state.angle + delta;
    }
    setState({ deg, angle });
    return angle;
  }
  return state.angle;
}

export function CompassBadge({ car, live, now }: { car: SavedCar; live: LiveCar; now: number }) {
  const fresh = live.motionAt !== null && now - live.motionAt < TELEMETRY_STALE_MS * 2;
  const raw = fresh ? (live.motion?.headingDeg ?? null) : null;
  const deg = raw === null ? null : relativeHeading(raw, car.headingOffset);
  const needle = useShortestAngle(deg);
  if (!hasCompass(car) || live.status !== 'connected') return null;
  if (deg === null) {
    return (
      <div className="compass compass--off" role="note">
        <CompassSvg angle={null} />
        <div className="compass__text">
          <strong>{live.motion ? t('compass.notCalibrated') : t('compass.noHeading')}</strong>
          {live.motion && <span>{t('compass.calibrateHow')}</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="compass"
      role="img"
      aria-label={`${t('compass.label')} ${cardinal(deg)} ${deg}°`}
    >
      <CompassSvg angle={needle} />
      <div className="compass__text" aria-hidden="true">
        <strong className="num">
          {cardinal(deg)} {deg}°
        </strong>
        <span>{t('compass.approx')}</span>
      </div>
    </div>
  );
}

function CompassSvg({ angle }: { angle: number | null }) {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" className="compass__dial" aria-hidden="true">
      <circle cx="24" cy="24" r="21" className="compass__ring" />
      {[0, 90, 180, 270].map((a) => (
        <line
          key={a}
          x1="24"
          y1="5"
          x2="24"
          y2={a === 0 ? 10 : 8}
          className={a === 0 ? 'compass__tick compass__tick--n' : 'compass__tick'}
          transform={`rotate(${a} 24 24)`}
        />
      ))}
      <text x="24" y="17.5" className="compass__n">
        N
      </text>
      {angle !== null && (
        <g className="compass__needle" style={{ transform: `rotate(${angle}deg)` }}>
          <path d="M24 12 L29 30 L24 27 L19 30 Z" />
        </g>
      )}
    </svg>
  );
}
