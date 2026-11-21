# STEMBOT Control

Drive STEMBOT micro:bit robot cars over Bluetooth, one car or a group. One React + TypeScript codebase ships as an installable web app (PWA, Web Bluetooth) and as Android and iOS apps (Capacitor + native BLE).

- Design spec: [docs/DESIGN.md](docs/DESIGN.md) · Product facts: [PRODUCT.md](PRODUCT.md)
- Car firmware v2.0 (MakeCode): `stembot_fw_boardA.ts`, `stembot_fw_boardB.ts`
- Car protocol: [docs/PROTOCOL.md](docs/PROTOCOL.md) · Firmware ideas: [docs/FIRMWARE_SUGGESTIONS.md](docs/FIRMWARE_SUGGESTIONS.md)
- Real-car test checklist: [docs/TEST_CHECKLIST.md](docs/TEST_CHECKLIST.md)
- Screenshots (mock cars): [docs/screenshots](docs/screenshots)

## Requirements

- Node 22 or newer (Capacitor 8 needs ≥ 22; tested with Node 24.18 / npm 11.16).
- Web: Chrome or Edge on Windows, macOS, Linux, ChromeOS or Android. Safari (Mac and iPhone) and Firefox have no Web Bluetooth: iPhone users need the iOS app.
- Web Bluetooth only works on `https://` or `http://localhost`.

## Run the web app

```powershell
npm install
npm run dev
```

Open http://localhost:5173. No car? Open http://localhost:5173/?mock=1 for four demo cars (turns on Dev options and Mock mode; the dev banner shows).

Production build and local preview (the build has the Content Security Policy and service worker):

```powershell
npm run build
npm run preview
```

Deploy `dist/` to any static HTTPS host. After the first load the app works offline and makes no network calls.

## Android (Windows)

Needs Android Studio 2025.2.1 or newer (Capacitor 8 requirement) with an Android SDK.

```powershell
npm run cap:android
```

That builds the web app, syncs it into `android/`, and opens Android Studio. Press Run with a phone connected (USB debugging on).

Command-line debug APK on Windows: Gradle here needs JDK 21. If `java -version` shows a newer JDK (this machine has Java 25), point Gradle at Android Studio's bundled JDK for that shell:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"; cd android; .\gradlew.bat assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

Permissions (in `android/app/src/main/AndroidManifest.xml`): Android 12+ asks only for **Nearby devices** (`BLUETOOTH_SCAN` with `neverForLocation`, `BLUETOOTH_CONNECT`). Android 11 and older use the legacy Bluetooth + location permissions, capped with `maxSdkVersion="30"`.

## iOS (needs a Mac)

iOS apps can only be built on macOS with Xcode 26 or newer (Capacitor 8 requirement). The `ios/` project was generated on Windows and is ready to open there:

```bash
npm install
npm run cap:ios
```

Then pick your team under Signing & Capabilities and run on a real iPhone (Bluetooth does not work in the simulator). `Info.plist` already has `NSBluetoothAlwaysUsageDescription`. Deployment target iOS 15.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run e2e
```

`npm run e2e` runs Playwright against the production build with mock cars, on a phone and a desktop viewport, including axe accessibility scans and the stop-safety tests. First time only: `npx playwright install chromium`.

## How it is built

```
src/
  protocol/   constants (UUIDs, timings, pin map), command encoder, telemetry parser   <- unit tested
  transport/  CarTransport interface + WebBluetooth, Capacitor BLE and Mock implementations
  control/    CarLink (one queue per car, newest wins, 80 ms keep-alive), fleet, safety  <- unit tested
  store/      Zustand: garage (persisted), settings (persisted), live state, dev log
  screens/    Garage, AddCar, Drive, Group, Settings, Dev
  ui/         design-system components (glass, radar, joystick, palette...)
  styles/     tokens.css, glass.css, components.css, screens.css
```

The UI never touches a Bluetooth API: ESLint blocks `navigator.bluetooth` and the BLE plugin outside `src/transport`.

Safety: release, STOP, Space, shake, tab hidden, window blur, page hide, native app pause and lost link all send `x`; a lifted car is stopped only if its "Stop when lifted" setting is on (firmware v2 default is off, so a lifted car keeps driving). The car's own 250 ms watchdog and disconnect stop are the second line of defence.
