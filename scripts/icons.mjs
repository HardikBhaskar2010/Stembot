// Generates every app icon from one geometry: the PWA icons, the favicon SVG,
// and the source images for Android/iOS (fed to @capacitor/assets).
//
//   node scripts/icons.mjs
//
// Concept: a robot car seen from above. Its two ultrasonic "eyes" emit sonar arcs,
// the same sonar the Drive screen's radar shows. Espresso ground, cream car, cyan signal.
// The in-app animated mark (src/ui/BrandMark.tsx) uses the same numbers.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const C = {
  bgTop: '#3A2418',
  bgBottom: '#1A120E',
  glow: '#A88462',
  signal: '#3EE6FF',
  bodyTop: '#F4ECE1',
  bodyBottom: '#C9B59B',
  wheel: '#1A120E',
};

/** Sonar arcs centred on the sensor (256, 280), opening upwards, +-42 degrees. */
export const ARCS = [
  { r: 70, opacity: 1 },
  { r: 120, opacity: 0.62 },
  { r: 170, opacity: 0.32 },
].map(({ r, opacity }) => {
  const a = (42 * Math.PI) / 180;
  const x1 = (256 - r * Math.sin(a)).toFixed(1);
  const x2 = (256 + r * Math.sin(a)).toFixed(1);
  const y = (280 - r * Math.cos(a)).toFixed(1);
  return { d: `M${x1} ${y}A${r} ${r} 0 0 1 ${x2} ${y}`, opacity };
});

/** The mark (arcs + car), 512 x 512 coordinate space, no background. */
function mark() {
  return `
  <path d="M256 280L142.3 153.6A170 170 0 0 1 369.7 153.6Z" fill="${C.signal}" opacity=".07"/>
  <g fill="none" stroke="${C.signal}" stroke-width="22" stroke-linecap="round">
    ${ARCS.map((a) => `<path d="${a.d}" opacity="${a.opacity}"/>`).join('\n    ')}
  </g>
  <rect x="160" y="318" width="34" height="76" rx="14" fill="${C.wheel}"/>
  <rect x="318" y="318" width="34" height="76" rx="14" fill="${C.wheel}"/>
  <rect x="186" y="262" width="140" height="156" rx="44" fill="url(#body)"/>
  <rect x="186" y="262" width="140" height="156" rx="44" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
  <circle cx="230" cy="294" r="18" fill="${C.wheel}"/>
  <circle cx="282" cy="294" r="18" fill="${C.wheel}"/>
  <circle cx="230" cy="294" r="8" fill="${C.signal}"/>
  <circle cx="282" cy="294" r="8" fill="${C.signal}"/>
  <rect x="226" y="372" width="60" height="10" rx="5" fill="${C.wheel}" opacity=".18"/>`;
}

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.bgTop}"/>
      <stop offset="1" stop-color="${C.bgBottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="70%" r="55%">
      <stop offset="0" stop-color="${C.glow}" stop-opacity=".42"/>
      <stop offset="1" stop-color="${C.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.bodyTop}"/>
      <stop offset="1" stop-color="${C.bodyBottom}"/>
    </linearGradient>
  </defs>`;

/**
 * @param {{ rounded?: boolean; background?: boolean; scale?: number }} o
 *   rounded: squircle tile (PWA, favicon); background: draw the espresso tile;
 *   scale: shrink the mark into a platform safe zone (Android adaptive foreground).
 */
function svg({ rounded = true, background = true, scale = 1 } = {}) {
  const rx = rounded ? 116 : 0;
  const t =
    scale === 1 ? '' : ` transform="translate(256 256) scale(${scale}) translate(-256 -256)"`;
  const tile = background
    ? `<rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>
  <rect width="512" height="512" rx="${rx}" fill="url(#glow)"/>
  ${rounded ? `<rect x="1.5" y="1.5" width="509" height="509" rx="${rx - 1.5}" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="3"/>` : ''}`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  ${tile}
  <g${t}>${mark()}
  </g>
</svg>
`;
}

const png = (s, size, file) => sharp(Buffer.from(s)).resize(size, size).png().toFile(file);

mkdirSync('public', { recursive: true });
mkdirSync('assets', { recursive: true });

// Web: rounded tile for "any" icons and the SVG favicon; full-bleed tile for maskable and Apple.
const rounded = svg({ scale: 1.08 });
const square = svg({ rounded: false, scale: 0.86 });
writeFileSync('public/logo.svg', rounded);
await png(rounded, 64, 'public/pwa-64x64.png');
await png(rounded, 192, 'public/pwa-192x192.png');
await png(rounded, 512, 'public/pwa-512x512.png');
await png(square, 512, 'public/maskable-icon-512x512.png');
await png(square, 180, 'public/apple-touch-icon-180x180.png');

// Native sources for @capacitor/assets (Android adaptive icon safe zone is ~66% of the canvas).
await png(svg({ rounded: false, scale: 0.86 }), 1024, 'assets/icon-only.png');
await png(
  svg({ rounded: false, background: false, scale: 0.62 }),
  1024,
  'assets/icon-foreground.png',
);
await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="url(#bg)"/><rect width="512" height="512" fill="url(#glow)"/></svg>`,
  ),
)
  .resize(1024, 1024)
  .png()
  .toFile('assets/icon-background.png');

// Splash: the mark small and centred on the espresso ground.
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">${defs}
  <rect width="2732" height="2732" fill="${C.bgBottom}"/>
  <g transform="translate(1110 1110) scale(1)">${svg({ rounded: true })
    .replace(/^[\s\S]*?<\/defs>/, '')
    .replace('</svg>', '')}</g>
</svg>`;
await png(splash, 2732, 'assets/splash.png');
await png(splash, 2732, 'assets/splash-dark.png');

console.log('icons written: public/logo.svg, public/*.png, assets/*.png');
