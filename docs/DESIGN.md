---
world: pinned-by-brief
direction: "Espresso night-ops in liquid glass: minimal, spacious, warm dark ground, neon cyan signal, caramel for group, sonar radar as the signature move"
mode: operate
---

# STEMBOT Control: design spec

Status: v1, written before code, then revised after the critique in section 11.

The direction is pinned by the owner's brief (cinematic sci-fi, dark, neon cyan + second accent, glass where earned) and the owner's warm palette added on Nov 21, 2026. This is an **Operate** surface: the world contributes type, palette, density and one signature move. Navigation and controls stay standard (buttons, toggles, sliders, sheets).

## 1. Personas

| Persona | Situation | Needs | Fears |
|---|---|---|---|
| **Maya, 11, student driver** | Floor of the classroom, phone in both hands, two cars | Drive right now; big obvious controls; fun feedback | Car runs off the table; "it's broken" messages she can't read |
| **Sam, parent/teacher helper** | Setting up 2 to 4 cars for kids | Name and colour cars, reconnect fast, know which car is which | Bluetooth jargon; kids sending a car flying |
| **Luna, maker/dev** | Laptop, MakeCode open, wheels off the ground | Raw telemetry, manual commands, UUIDs, export logs | A UI that hides what the link is doing |

## 2. Key flows

1. **First run to driving (target < 30 s)**: Garage empty state → "Add your first car" → Switch it on (auto-advance on tap "It's on") → system chooser picks a `BBC micro:bit` → name pre-filled ("Car 1"), colour pre-picked → "Start driving" → Drive.
2. **Return visit**: Garage shows saved cars as "Not connected" → tap "Connect" on a card (one tap, chooser only if the browser forgot the device) → "Drive".
3. **Group drive**: connect 2+ cars → "Group" → tick cars, set per-car speed and reverse → drive with one control → any car dropping shows a red card and the rest keep going.
4. **Emergency**: STOP (header, giant on Drive) / Space / shake / lifting the car / switching tabs / closing the app → every car gets `x`.
5. **Dev**: Settings → Enable dev options → banner appears → Dev screen tabs.

## 3. Information architecture

```
Garage (home, #/)
├── Add car (#/add)            step flow: power → pick → name+colour
├── Drive (#/drive/:carId)      single car
├── Group (#/group)             all ticked cars
├── Settings (#/settings)
│   └── Dev options (#/dev)     only when enabled
└── Command palette (overlay, Ctrl/Cmd+K, or "Commands" button → bottom sheet on mobile)
```

Hash routing so the Android back button and browser back work without a server.

## 4. Screen list

| Screen | Primary action | Contents |
|---|---|---|
| Garage | **Drive** (or **Add car** when empty) | Car cards: colour strip, name, state chip, last distance, link/power hint, Connect/Disconnect. Bottom bar: Add car · Group · Drive |
| Add car | **Pick my car** | 3 steps with progress; error panels for Bluetooth off, permission denied, unsupported, already added, cancelled |
| Drive | (Hold to drive) | Header with back, car name, link bars, Commands. Radar panel. Giant STOP. Joystick or arrow pad (left thumb), speed mode + quick commands (right) |
| Group | (Hold to drive) | Same deck as Drive; car strip with include toggle per car; per-car speed/reverse in an expandable row; drift note |
| Settings | (none, instant apply) | Control style, units, haptics, sound, shake to stop, motion intensity, dev toggle |
| Dev options | (none) | Tabs: Live data · Commands · Console · Device · Pin map · Mock & export |

## 5. Design tokens

Dark only: cars are driven in classrooms and living rooms, but the brief pins a dark cinematic world, and a dark ground keeps the radar and state colours legible.

### Colour

Base palette supplied by the owner (Nov 21, 2026): `#1A120E` `#3A2418` `#6B4A2E` `#A88462` `#D5C4AE` `#4A4A46`. Espresso grounds, cream ink, caramel as the second accent. Neon cyan from the original brief stays as the single restrained signal colour, so the world reads as teal light on warm dark metal. Safety colours (green, amber, red) are added only where they carry meaning. Tokens marked _derived_ are tints between the owner's swatches, added to reach contrast targets.

| Token | Value | Use | Contrast (on `--void` / `--hull-3`) |
|---|---|---|---|
| `--void` | `#1A120E` (owner) | page ground | |
| `--hull-1` | `#221813` (derived) | panels, cards | |
| `--hull-2` | `#2C1E16` (derived) | raised controls | |
| `--hull-3` | `#3A2418` (owner) | hover, pressed, selected | |
| `--hull-4` | `#6B4A2E` (owner) | active fills, slider fill, depth glow | |
| `--line` | `#4A4A46` (owner) | 1px decorative dividers only | 2.1 (not used for control edges) |
| `--line-strong` | `#8A7560` (derived) | control boundaries, toggle tracks | 4.2 / 3.3 (≥ 3:1 non-text) |
| `--ink-hi` | `#F4ECE1` (derived) | headings, values | 15.8 / 12.4 |
| `--ink` | `#D5C4AE` (owner) | body text | 10.9 / 8.5 |
| `--ink-dim` | `#B39B80` (derived) | secondary text | 7.0 / 5.5 |
| `--caramel` | `#A88462` (owner) | second accent: group mode, brand mark, Turbo ring; text only ≥ 18.66px bold or on `--void`..`--hull-2` | 5.4 / 4.25 |
| `--signal` | `#3EE6FF` | primary accent: primary action, focus ring, live data, radar | 12.3 / 9.7 |
| `--signal-ink` | `#0B1418` | text on signal fills | 12.4 on signal |
| `--go` | `#5FE3A1` | connected, safe | 11.4 / 9.0 |
| `--caution` | `#FFB547` | < 50 cm, degraded link, dev banner | 10.5 / 8.3 |
| `--danger` | `#FF6B6B` | < 20 cm, lost, lifted (text and strokes) | 6.7 / 5.2 |
| `--stop` | `#C8202F` | STOP fill only | white text 5.7 |

Car tags (always shown with the name, never colour alone): Cyan `#3EE6FF`, Caramel `#D9A877`, Lime `#B6F24A`, Violet `#A58BFF`, Coral `#FF8A6B`, Cream `#F4ECE1`.

### Type

- **Display / data**: Chakra Petch 500/600/700, self-hosted via `@fontsource` (no network). Squared terminals give the sci-fi voice; used for headings, car names, readouts, buttons. Tabular numerals via `font-variant-numeric: tabular-nums`.
- **Body / UI text**: system UI sans (`system-ui, -apple-system, Segoe UI, Roboto, sans-serif`). Fast, legible at small sizes.
- **Mono**: `ui-monospace` only in Dev options (raw data).
- Scale (ratio 1.2, rem): 0.75 · 0.875 · 1 · 1.2 · 1.44 · 1.73 · 2.07, readout 3rem. Tracking: display -0.01em, caps labels +0.06em.

### Space, shape, depth (Minimal · Liquid Glass · Spacious, owner direction Nov 21, 2026)

- **Spacious**: base unit 8. Scale 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96. Screen gutters 24 px mobile, 48 px desktop. Cards breathe: 24 px padding, 16 px gap minimum. At most one heading, one primary action and one content group visible per screen region.
- **Minimal**: no decorative borders or dividers; separation comes from space and from glass layers. No icons without a job. Labels short. Secondary actions sit as quiet text-weight buttons.
- Radius: capsules (999px) for buttons, chips and the command bar; cards 28px; sheets 32px top corners; STOP is a 999px capsule.

#### Liquid Glass on the web

Adapted from the `liquid-glass-design` skill (installed from `affaan-m/ecc`, written for SwiftUI/UIKit). Its rules carry over; its APIs do not, so the web build uses CSS:

| Skill rule | Web implementation |
|---|---|
| Glass blurs and reflects what is behind it | `backdrop-filter: blur(24px) saturate(160%)` over a living ground (see "Ambient light" below). Never glass over a flat opaque fill. |
| Regular glass + tint for prominence | `.glass` = `rgb(244 236 225 / .06)` fill; `.glass--tint-signal` adds a 14% cyan tint for the primary action; `.glass--tint-caramel` for group mode |
| Specular edge | 1px inner highlight: `inset 0 1px 0 rgb(255 255 255 / .18)` top, `inset 0 -1px 0 rgb(0 0 0 / .25)` bottom, plus a soft outer shadow `0 24px 60px -20px rgb(0 0 0 / .6)` |
| `.interactive()` only on controls | Interactive glass gets a pointer-following radial highlight (`--mx/--my` CSS vars, updated on pointermove, transform-free) and a press squash (scale .97). Static cards don't react. |
| `GlassEffectContainer` groups siblings | Sibling controls (speed modes, quick commands, bottom bar) share one glass capsule with inner segments, instead of many separate blurred layers (fewer backdrop-filter passes = faster) |
| Morphing between related elements | Segmented selections slide a single glass "lens" between segments (transform only, 220 ms) |
| Don't glass everything | Glass: top bar, bottom action bar, car cards, drive deck, sheets, toasts, palette. Solid: STOP (always opaque red, never translucent), radar face, text fields. |
| Keep contrast | All text on glass is checked against the darkest and lightest ground it can sit on; ink tokens hold ≥ 4.5:1 because the glass fill is ≤ 8% light over a ground that stays ≤ `#3A2418` |

**Ambient light (what the glass refracts)**: the page ground is `--void` with three large, blurred, static radial glows: caramel `#A88462` top-left (18% opacity), brown `#6B4A2E` bottom-right (30%), faint cyan top-right (7%). On Drive the radar itself sits behind the deck glass. Painted once on a fixed layer; no animation.

**Glass intensity setting** (the brief's "theme intensity"): Full (default) · Subtle (blur 12px, no pointer highlight) · Off (opaque `--hull-1` surfaces, for slow phones). `prefers-reduced-transparency: reduce` selects Off automatically where supported.

- Focus: 2px `--signal` ring with 3px offset, on every interactive element.
- Targets: ≥ 48 px; drive controls ≥ 72 px; STOP ≥ 76 px high, full width on mobile.

## 6. Signature move: the sonar radar

A semicircular sonar fan drawn in SVG at the front of the car glyph. Range rings at 20, 50 and 100 cm, a sweep line, and an echo arc at the measured distance.

- ≥ 50 cm: `--signal`. 20 to 50 cm: `--caution`, label "Close". < 20 cm: `--danger`, label "Very close".
- `cm = 0`: rings dim, label "No echo" (not "0 cm"). Cars with no working sensor never look like they're touching a wall.
- Lifted: fan replaced by "Lifted: car stopped" with a wheels-up glyph; drive controls disabled for that car.
- No data for > 1 s: "Waiting for data" and dimmed.

The same echo arc appears small on each Garage card (last reading), which ties the home screen to the drive screen.

## 7. Motion rules

- State transitions 160 ms, `cubic-bezier(.2,.8,.2,1)` (exponential-ish ease-out). Screen change 180 ms fade + 8 px rise.
- Radar sweep: 2.4 s linear loop, transform-only (GPU). Echo arc eases to new distance over 120 ms.
- Press feedback: scale .96 in 60 ms on drive controls and STOP; haptic tick on mobile.
- Connected chip: one 600 ms glow when a car connects, not a loop.
- No page-load choreography, no decorative loops except the radar sweep.
- `prefers-reduced-motion: reduce` or Settings → Motion "Calm": sweep stops (static fan), no rises, no glow; state still changes instantly.
- Budget: only `transform`/`opacity` animate continuously; 60 fps on a mid Android phone is the bar.

## 8. Empty, loading and error states (copy)

Voice: short, plain, kind. Say what happened, then what to do. Car names come from the user.

| Situation | Title | Body | Action |
|---|---|---|---|
| Garage empty | No cars yet | Switch on your STEMBOT car and add it here. It takes about 20 seconds. | **Add your first car** |
| Unsupported browser | This browser can't use Bluetooth | Open this page in Chrome or Edge on a computer or Android phone. On iPhone or iPad, use the STEMBOT Control app. | Copy link |
| Bluetooth off | Bluetooth is off | Turn on Bluetooth on this device, then try again. | **Try again** |
| Permission denied | STEMBOT needs Bluetooth permission | Allow Bluetooth for this app in your device settings, then try again. | **Try again** |
| Chooser cancelled | No car picked | Your car shows up as "BBC micro:bit …". Is it switched on and close by? | **Try again** |
| Already added | {name} is already in your garage | You can connect it from the garage. | **Go to garage** |
| Connecting | Connecting to {name}… | — | Cancel |
| Connect failed | Couldn't reach {name} | Make sure it's on and close by. If it keeps failing, check its batteries. | **Try again** |
| Lost connection | {name} lost connection | It stopped by itself. Bring it closer, then reconnect. | **Reconnect** |
| Lifted | Lifted: {name} stopped | Put it back on the floor to drive. | — |
| No echo | No echo | Nothing in range, or this car has no distance sensor. | — |
| Power hint | Check batteries | {name} dropped {n} times. Weak batteries cause this. | — |
| Group drift note | — | Cars can't see each other, so they drift apart over distance. Line them up again now and then. | — |

Terminology is fixed: **car** (not device), **connect** (not pair), **stop** (not halt), **garage**, **group drive**.

## 9. Accessibility plan

- Every control is a real `<button>`, `<input type="range">`, or `role="switch"` button with a visible label or `aria-label`.
- Joystick: `role="application"` region labelled "Drive pad: hold arrow keys or drag". Keyboard users drive with WASD/arrows anywhere on Drive; the arrow-pad style exposes four labelled hold buttons ("Forward, hold to drive").
- Live regions: polite for state changes ("Car A connected"), assertive for safety events ("Car A lost connection", "Lifted"). Radar announces only on zone change, never every reading.
- Colour is never alone: zones carry words, states carry icons + words.
- Contrast: all text ≥ 4.5:1, large ≥ 3:1, non-text UI ≥ 3:1 (checked by axe in the Playwright run).
- Focus order follows reading order; the command palette traps focus while open and returns it on close; Escape closes overlays.
- Targets ≥ 48 px, STOP ≥ 72 px.
- Reduced motion respected (section 7).
- `lang="en"`, all copy in `src/i18n/en.ts` for translation.

## 10. Layouts

- **Mobile portrait (≤ 640 px)**: header 56 px; content scrolls; Garage bottom action bar fixed. Drive: radar (≈ 38% height), STOP full-width bar, deck: joystick bottom-left, right column with speed modes and quick commands. Commands open as a bottom sheet.
- **Mobile landscape**: three columns, joystick | radar + STOP | speed + commands.
- **Desktop (≥ 1024 px)**: Garage grid 3 to 4 columns. Drive: radar centre, on-screen pad left, commands right, keyboard hint overlay shown once.

## 11. Self-critique (design-critique + accessibility-review skills) and fixes

| Finding | Severity | Fix applied to this spec |
|---|---|---|
| Two red tokens (`--danger`, `--stop`) could blur meaning | Minor | STOP is the only filled red; `--danger` is used for text/strokes only |
| Caramel accent and Caramel car tag could collide in group mode | Moderate | Group mode uses caramel only for the mode badge and pad ring; car identity always shows name + tag |
| Owner palette has no high-contrast line colour; `#4A4A46` is 2.1:1 | Moderate (1.4.11) | `#4A4A46` only for decorative dividers; control edges use derived `--line-strong` (≥ 3:1) |
| Caramel small text on `#3A2418` is 4.25:1 | Moderate | Caramel never used as small text on `--hull-3` |
| Joystick is unusable for screen-reader users | Critical | Arrow-pad buttons are always reachable by keyboard; keys work on Drive; joystick canvas is `aria-hidden` with the region labelled |
| "Battery-health" would be a fake measurement | Critical (honesty) | Shown as "Power: hint" derived from link drops, worded as a hint |
| STOP in header on Garage could be mistaken for a nav button | Moderate | Header STOP is red-filled with a stop icon and only appears when a car is connected |
| Radar label "0 cm" when sensor missing | Critical (safety/honesty) | `cm = 0` → "No echo" state |
| Dense dev content leaking into main screens | Moderate | Raw data only in Dev options; main screens show words and the radar |
| Glass everywhere would be decoration and slow on mid Android | Moderate | Glass on controls, bars, cards and overlays only; siblings share one glass container; intensity setting with an Off mode |
| Translucent STOP could read as disabled | Critical (safety) | STOP is the one opaque, saturated surface on every screen |
| Kids may hit Turbo by accident | Moderate | Default mode Normal; Turbo needs a deliberate tap and shows a caramel ring, Slow is one tap away |
| Lock controls could trap a user | Moderate | Lock never blocks STOP; unlock is a long-press (600 ms) with progress |
| First run had a dead "It's on" tap before the chooser | Moderate (30 s goal) | Step 1's primary button **Find my car** opens the chooser directly; the step label still says "Switch the car on". The car connects during adding, so step 3 ends in **Start driving** |
| Garage "Drive" is ambiguous with several cars | Moderate | Bottom bar primary reads **Drive {name}** (last driven connected car); with 2+ connected, **Group drive** sits beside it; each card also has its own Drive |
| Space as "stop" collides with Space activating a focused button | Moderate | On Drive and Group, Space is captured at window level, prevents default, and always stops all; buttons there activate with Enter |
| Which car am I driving? | Moderate | Drive header shows the car's colour strip and name at heading size; Group shows a chip row of included cars |
| Quick-command pulses could outlive a lost focus | Critical (safety) | Pulses are timers inside the command layer and are cancelled by the same stop path as release/blur/hide |
