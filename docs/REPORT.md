# STEMBOT Control: build report (2026-11-21)

## What was built

- **One React 19 + TypeScript 6 + Vite 8 codebase**, shipped as a PWA (Web Bluetooth) and as Capacitor 8 Android/iOS apps (`@capacitor-community/bluetooth-le` 8.4).
- **Screens**: Garage, Add car (3 steps + 6 problem states), Drive (joystick or arrow pad, radar, giant STOP, speed modes, pinned quick commands, lock), Group drive (include toggles, per-car speed and reverse, drift note), Settings, Dev options (live data, command log, console, device/UUIDs, pin map, mock & export), command palette (Ctrl/Cmd+K, bottom sheet on phones).
- **Bluetooth behind one interface** `CarTransport` with `WebBluetoothTransport`, `CapacitorBleTransport`, `MockTransport`. ESLint forbids Bluetooth APIs outside `src/transport`.
- **Command layer** `CarLink`: one write in flight per car, newest wins, 80 ms keep-alive, 600 ms write timeout, stop retry, pulses for nudge/spin, blocked when lifted or locked.
- **Design system**: tokens from the owner's palette, Liquid Glass material for the web (adapted from the `liquid-glass-design` skill), sonar radar as the signature element, glass intensity and motion settings, reduced motion respected.
- **Docs**: `PRODUCT.md`, `docs/DESIGN.md`, `docs/PROTOCOL.md`, `docs/FIRMWARE_SUGGESTIONS.md`, `docs/TEST_CHECKLIST.md`, `docs/verification-log.txt`, screenshots in `docs/screenshots/`.

See README.md for how to run on web, Android and iOS.

## Checks run (final code, full log in docs/verification-log.txt)

| Command | Result |
|---|---|
| `npm install` | OK. 4 moderate advisories, all in dev-only `workbox-build` deps (glob, minimatch); `npm audit --omit=dev` = 0 |
| `npm run typecheck` | 0 errors (strict, `noUncheckedIndexedAccess`) |
| `npm run lint` | 0 errors, 0 warnings (first full run failed on one regex lint error; fixed and re-run) |
| `npm run format:check` | clean |
| `npm test` (Vitest) | 45 / 45 passed (encoder, reverse wheels, telemetry parser incl. 14 malformed inputs, CarLink timing / newest-wins / stop retry / hung write / independent cars) |
| `npm run build` | OK. JS 334 kB (104 kB gzip), CSS 7.6 kB gzip, fonts ~10 kB each, PWA precache 27 files |
| `npm run e2e` (Playwright, phone 390×844 + desktop 1440×900, prod build, CSP on) | 29 / 29 passed |
| axe-core (WCAG 2.0/2.1/2.2 A+AA) | 11 screens × 2 viewports, 0 violations of any impact |
| Impeccable detector | 4 warnings (joystick stripes) fixed, 0 remaining |
| `gradlew assembleDebug` | BUILD SUCCESSFUL, `app-debug.apk` 4.5 MB; merged permissions checked with aapt2 |

Safety cases covered by e2e on mock cars: release of key and joystick, window blur, tab hidden, Space, giant STOP, lifted car refuses drive, lost link stops and offers reconnect, lock blocks drive but not STOP, arrow keys in the speed selector don't drive, group drive with one lifted and one dropped car.

## Not tested

Real Bluetooth hardware, any real phone, iOS (not built: needs a Mac), the native BLE transport, Capacitor app-pause stop, multi-car timing on real radios, shake detection, 60 fps on a real mid-range Android, PWA install prompt. See docs/TEST_CHECKLIST.md.

## Quality level, honestly

- **Production-grade (tested):** protocol encoder and telemetry parser, CarLink command layer, the stop paths in the web app (against the mock).
- **MVP:** all screens and flows, PWA, Android project and debug build, design system.
- **Prototype:** native BLE transport (compiles, never run), iOS project (generated, never built), shake-to-stop, firmware suggestions.
