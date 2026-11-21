import { ArrowUpFromLine, Radar as RadarIcon } from 'lucide-react';
import { t } from '../i18n/en';
import { ZONE_CLOSE_CM, ZONE_VERY_CLOSE_CM } from '../protocol/constants';
import type { Units } from '../store/settings';

export type Zone = 'clear' | 'close' | 'very-close';
export type RadarState = 'live' | 'no-echo' | 'waiting' | 'lifted' | 'offline';

export function zoneOf(cm: number): Zone {
  if (cm < ZONE_VERY_CLOSE_CM) return 'very-close';
  if (cm < ZONE_CLOSE_CM) return 'close';
  return 'clear';
}

export function formatDistance(cm: number, units: Units): { value: string; unit: string } {
  if (units === 'in') return { value: (cm / 2.54).toFixed(cm < 25 ? 1 : 0), unit: 'in' };
  return { value: String(Math.round(cm)), unit: 'cm' };
}

const W = 400;
const CX = 200;
const CY = 212;
const R = 188;
const MAX_CM = 150;

/** sqrt scale gives the near zones more room, where they matter. */
function radius(cm: number) {
  return R * Math.sqrt(Math.min(cm, MAX_CM) / MAX_CM);
}

function arc(r: number, fromDeg: number, toDeg: number) {
  const p = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;
  };
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${p(fromDeg)} A ${r} ${r} 0 ${large} 1 ${p(toDeg)}`;
}

export function Radar({
  state,
  distanceCm,
  units,
  carName,
  compact = false,
}: {
  state: RadarState;
  distanceCm: number | null;
  units: Units;
  carName?: string;
  compact?: boolean;
}) {
  const live = state === 'live' && distanceCm !== null;
  const zone: Zone = live ? zoneOf(distanceCm) : 'clear';
  const scale = live ? radius(distanceCm) / R : 1;
  const d = live ? formatDistance(distanceCm, units) : null;

  return (
    <section
      className={`radar radar--${state} radar--${zone} ${compact ? 'radar--compact' : ''}`}
      aria-label={carName ? `${t('radar.label')}, ${carName}` : t('radar.label')}
    >
      <svg viewBox={`0 0 ${W} 222`} className="radar__svg" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="radar-fan" cx="50%" cy="100%" r="100%">
            <stop offset="0" stopColor="rgb(62 230 255)" stopOpacity="0.16" />
            <stop offset="1" stopColor="rgb(62 230 255)" stopOpacity="0.02" />
          </radialGradient>
          <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgb(62 230 255)" stopOpacity="0" />
            <stop offset="1" stopColor="rgb(62 230 255)" stopOpacity="0.28" />
          </linearGradient>
        </defs>
        <path
          d={`${arc(R, -90, 90)} L ${CX} ${CY} Z`}
          fill="url(#radar-fan)"
          className="radar__fan"
        />
        {[-60, -30, 0, 30, 60].map((deg) => {
          const a = ((deg - 90) * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={CX}
              y1={CY}
              x2={CX + R * Math.cos(a)}
              y2={CY + R * Math.sin(a)}
              className="radar__spoke"
            />
          );
        })}
        {[ZONE_VERY_CLOSE_CM, ZONE_CLOSE_CM, 100, MAX_CM].map((cm) => (
          <g key={cm}>
            <path d={arc(radius(cm), -90, 90)} className={`radar__ring radar__ring--${cm}`} />
            {cm !== MAX_CM && (
              <text x={CX + radius(cm) + 4} y={CY - 6} className="radar__ring-label">
                {units === 'in' ? Math.round(cm / 2.54) : cm}
              </text>
            )}
          </g>
        ))}
        {state === 'live' && (
          <g className="radar__sweep">
            <path
              d={`M ${CX} ${CY} L ${CX} ${CY - R} ${arc(R, 0, 14).replace(/^M [^A]+/, '')} Z`}
              fill="url(#radar-sweep)"
            />
          </g>
        )}
        {live && (
          <g className="radar__echo" style={{ transform: `scale(${scale})` }}>
            <path
              d={arc(R, -34, 34)}
              className="radar__echo-glow"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={arc(R, -34, 34)}
              className="radar__echo-line"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
        <rect x={CX - 22} y={CY - 10} width="44" height="22" rx="11" className="radar__car" />
      </svg>

      <div className="radar__readout" aria-live="off">
        {state === 'lifted' ? (
          <div className="radar__status radar__status--lifted">
            <ArrowUpFromLine size={28} aria-hidden="true" />
            <div>
              <strong>{t('radar.lifted')}</strong>
              {!compact && <span>{t('radar.liftedBody')}</span>}
            </div>
          </div>
        ) : state === 'no-echo' ? (
          <div className="radar__status">
            <RadarIcon size={24} aria-hidden="true" />
            <div>
              <strong>{t('radar.noEcho')}</strong>
              {!compact && <span>{t('radar.noEchoBody')}</span>}
            </div>
          </div>
        ) : state === 'waiting' || state === 'offline' ? (
          <div className="radar__status radar__status--dim">
            <strong>{state === 'offline' ? t('status.offline') : t('radar.waiting')}</strong>
          </div>
        ) : d ? (
          <div className="radar__value">
            <span className="radar__num num">{d.value}</span>
            <span className="radar__unit">{d.unit}</span>
            <span className={`radar__zone radar__zone--${zone}`}>
              {zone === 'very-close'
                ? t('radar.veryClose')
                : zone === 'close'
                  ? t('radar.close')
                  : t('radar.clear')}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Tiny echo arc for garage cards: ties home to the drive radar. */
export function MiniEcho({ cm }: { cm: number | null }) {
  const zone = cm === null ? null : zoneOf(cm);
  const r = cm === null ? 0 : 6 + 14 * Math.sqrt(Math.min(cm, MAX_CM) / MAX_CM);
  return (
    <svg
      viewBox="0 0 48 28"
      width="48"
      height="28"
      aria-hidden="true"
      className={`mini-echo mini-echo--${zone ?? 'none'}`}
    >
      <path d="M 4 26 A 20 20 0 0 1 44 26" className="mini-echo__ring" />
      <path d="M 14 26 A 10 10 0 0 1 34 26" className="mini-echo__ring" />
      {cm !== null && (
        <path
          d={`M ${24 - r * 0.7} ${26 - r * 0.7} A ${r} ${r} 0 0 1 ${24 + r * 0.7} ${26 - r * 0.7}`}
          className="mini-echo__echo"
        />
      )}
      <rect x="19" y="23" width="10" height="5" rx="2.5" className="mini-echo__car" />
    </svg>
  );
}
