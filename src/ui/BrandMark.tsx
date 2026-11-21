import { useId } from 'react';

/**
 * The STEMBOT mark: a robot car seen from above whose ultrasonic "eyes" send out sonar arcs.
 * Same geometry as the app icon (scripts/icons.mjs), drawn inline so its parts can move.
 *
 * Motion (see src/styles/motion.css), each tied to a rare moment, never to routine UI:
 * - `draw`:   first run / empty garage. Arcs draw on from the eyes outward, the car settles.
 * - `search`: waiting for the user to pick a car. Sonar pings travel outward on a loop.
 * - `ping`:   a car just connected. One outward ping, then rest.
 * - `static`: everywhere else.
 */
export type BrandMotion = 'static' | 'draw' | 'search' | 'ping';

const ARCS = [70, 120, 170].map((r, i) => {
  const a = (42 * Math.PI) / 180;
  const x1 = (256 - r * Math.sin(a)).toFixed(1);
  const x2 = (256 + r * Math.sin(a)).toFixed(1);
  const y = (280 - r * Math.cos(a)).toFixed(1);
  return { d: `M${x1} ${y}A${r} ${r} 0 0 1 ${x2} ${y}`, rest: [1, 0.62, 0.32][i] ?? 1 };
});

export function BrandMark({
  size = 36,
  motion = 'static',
  tile = true,
  className = '',
}: {
  size?: number;
  motion?: BrandMotion;
  /** Draw the espresso app-icon tile behind the mark. */
  tile?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const bg = `bm-bg-${uid}`;
  const glow = `bm-glow-${uid}`;
  const body = `bm-body-${uid}`;
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`brand-mark brand-mark--${motion} ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A2418" />
          <stop offset="1" stopColor="#1A120E" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="70%" r="55%">
          <stop offset="0" stopColor="#A88462" stopOpacity=".42" />
          <stop offset="1" stopColor="#A88462" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4ECE1" />
          <stop offset="1" stopColor="#C9B59B" />
        </linearGradient>
      </defs>
      {tile && (
        <>
          <rect width="512" height="512" rx="116" fill={`url(#${bg})`} />
          <rect width="512" height="512" rx="116" fill={`url(#${glow})`} />
          <rect
            x="1.5"
            y="1.5"
            width="509"
            height="509"
            rx="114.5"
            fill="none"
            stroke="#fff"
            strokeOpacity=".08"
            strokeWidth="3"
          />
        </>
      )}
      <g transform={tile ? 'translate(256 256) scale(1.08) translate(-256 -256)' : undefined}>
        <path
          className="brand-mark__fan"
          d="M256 280L142.3 153.6A170 170 0 0 1 369.7 153.6Z"
          fill="#3EE6FF"
          opacity=".07"
        />
        <g fill="none" stroke="#3EE6FF" strokeWidth="22" strokeLinecap="round">
          {ARCS.map((arc, i) => (
            <path
              key={arc.d}
              className={`brand-mark__arc brand-mark__arc--${i}`}
              d={arc.d}
              pathLength={1}
              style={{ ['--rest' as string]: arc.rest }}
            />
          ))}
        </g>
        <g className="brand-mark__car">
          <rect x="160" y="318" width="34" height="76" rx="14" fill="#1A120E" />
          <rect x="318" y="318" width="34" height="76" rx="14" fill="#1A120E" />
          <rect x="186" y="262" width="140" height="156" rx="44" fill={`url(#${body})`} />
          <rect
            x="186"
            y="262"
            width="140"
            height="156"
            rx="44"
            fill="none"
            stroke="#fff"
            strokeOpacity=".5"
            strokeWidth="2"
          />
          <circle cx="230" cy="294" r="18" fill="#1A120E" />
          <circle cx="282" cy="294" r="18" fill="#1A120E" />
          <circle className="brand-mark__eye" cx="230" cy="294" r="8" fill="#3EE6FF" />
          <circle className="brand-mark__eye" cx="282" cy="294" r="8" fill="#3EE6FF" />
          <rect x="226" y="372" width="60" height="10" rx="5" fill="#1A120E" opacity=".18" />
        </g>
      </g>
    </svg>
  );
}
