# STEMBOT car protocol (app side)

Source of truth: firmware v2.2 (`stembot_fw_boardA.ts`, `stembot_fw_boardB.ts` in the repo root) and the GATT log from the real car (Nov 2026). Code: `src/protocol/`.

## Link

| Item | Value | Status |
|---|---|---|
| Board | BBC micro:bit V2, MakeCode, official Bluetooth extension, "No Pairing Required" | OBSERVED |
| Name filter | prefix `BBC micro:bit` | OBSERVED |
| Service | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` (UART) | OBSERVED |
| App → car | `6e400003-…` write / write-without-response | OBSERVED (docs label it the other way) |
| Car → app | `6e400002-…` indicate | OBSERVED |
| Max write | 20 bytes | per brief |

## Commands (app → car)

One command per write, ending in `\n`, at most 20 bytes.

| Text | Meaning | Sent by the app when |
|---|---|---|
| `w<speed>` | forward | holding forward (keep-alive every 80 ms) |
| `s<speed>` | backward | holding back |
| `a<speed>` | spin left | holding left / spin pulse |
| `d<speed>` | spin right | holding right / spin pulse |
| `x` | stop | release, STOP, blur, tab hidden, app pause, lock, disconnect, and on lift only for cars with "Stop when lifted" on |
| `?` | capability query; car replies `C:<version>,<hasUltrasonic>,<hasHorn>` | once after connecting |
| `h`, `l` | honk, locate | only if the car answered `?` with `hasHorn=1` |
| `i1` / `i0` | lift-off stop on / off. **Car default off** (a lifted car keeps driving). Resets to off on disconnect | ~300 ms after the first `x` of every (re)connect, and when the user flips the car's "Stop when lifted" |
| `o<cm>` / `o0` | forward obstacle stop at 10–100 cm / off. Resets on disconnect | after (re)connect only if the user set it; `o0` when the user turns it off |
| `m1` / `m0` | car sounds on / off (v2.1, car default on, resets on disconnect) | after every (re)connect, and when Settings → Car sounds changes |
| `k1` / `k0` | clap commands on / off (v2.1, default off, resets on disconnect) | after (re)connect if the car's Clap commands switch is on, and when it changes |
| `f<cm>,<speed>` / `b<cm>,<speed>` | step about `cm` (1–100) forward / back holding the compass heading (v2.2) | Step forward / Step back quick commands and voice ("step forward"), 10 cm at the car's speed |
| `r1` / `r0` | wheels reversed at runtime (v2.2, resets on disconnect; combined with compiled `FLIP`) | after (re)connect and when "Reverse wheels" changes, **only once this session's `C:` reply says 2.2+** |

Unknown letters are ignored by the car and do not refresh its watchdog (firmware v2, verified in source).

- Speed is always sent inline (`w700`), clamped to 200..1023. The app never uses `q`/`e`, so the app is the single source of truth for speed. Keys Q/E change the per-car speed stored in the app by 100.
- Per-car effective speed = car speed × mode (Slow 0.6, Normal 1.0, Turbo 1.4), clamped.
- Reverse wheels (per car, in the app): `w↔s`, `a↔d`. Firmware also has a `FLIP` constant; use one or the other, not both.

## Timing and the command layer (`src/control/CarLink.ts`)

- The car stops itself if no drive letter arrives for 250 ms. While a control is held the app resends every 80 ms.
- One write in flight per car. While it is in flight only the newest command waits; older ones are dropped and counted ("Replaced (newest wins)" in dev options).
- A write that takes longer than 600 ms is abandoned so a later `x` is not stuck behind it. A failed `x` is retried once.
- Each car has its own link, so a slow car never delays a fast one (unit-tested with 200 ms vs 5 ms fake links).

## Telemetry (car → app)

`D:<cm>,<irL>,<irR>,<air>\n` about every 150 ms (OBSERVED: `D:12,0,0,0`).

| Field | Meaning | App handling |
|---|---|---|
| `cm` | ultrasonic distance | `0` → "No echo" (never "0 cm"); > 500 → line rejected |
| `irL`, `irR` | bottom IR, 1 = no floor | shown in dev options |
| `air` | 1 = lifted. Reported whether or not the car stops | if that car's "Stop when lifted" is on: app sends `x`, blocks drive, shows "Lifted: stopped". If off (default): car stays drivable, calm "Lifted (still drivable)" |

Parsing (`src/protocol/telemetry.ts`): lines are reassembled across BLE chunks, buffer capped at 64 chars, non-printable bytes rejected, strict regex per line type, unknown lines only logged. The firmware v2 handshake reply `C:<version>,<hasUltrasonic>,<hasHorn>` is parsed, stored per car, and shown raw in dev options.

## Firmware v2 settings and reconnects (`src/control/fleet.ts`)

1. Connect → `x` (known state) → `?`.
2. 300 ms later → `i1` or `i0` (always) and `o<cm>` (only if set). Both reset on the car whenever the link drops, so this runs after every reconnect.
3. Dev options → Live data → "Sent to each car" shows the last `i`/`o` sent per car and the raw `C:` reply.

Per board (from the firmware files): Board A `FLIP = false`, `HAS_ULTRASONIC = 1`; Board B `FLIP = true`, `HAS_ULTRASONIC = 0`. With firmware `FLIP` set, keep the app's "Reverse wheels" off for that car, or they cancel out. Obstacle stop is hidden in the app for cars that report `hasUltrasonic = 0`.

## Firmware v2.1 additions

| Line (car → app) | Meaning | App handling |
|---|---|---|
| `C:<ver>,<us>,<horn>,<compass>` | 4th field = has compass (v2.1). 3-field replies still accepted | compass and clap options appear only for cars that report a compass |
| `M:<heading>,<pitch>,<roll>,<bump>` | ~6.7 Hz. heading 0–359 or `-1` (not calibrated: press A on the car); pitch/roll −180..180; bump 1 = jolt since the last line | compass dial on Drive (per-car "north" offset), heading per car in Group, bump = haptic + radar flash |
| `K:<claps>` | a clap command started on the car (1 = forward 1 s, 2 = turn right 90°, 3 = turn around) | "heard N claps" chip on Drive, screen-reader announcement |

Command queue rule (`CarLink`): drive and stop lines are newest-wins; settings lines (`i o m k ? h l` and dev raw) queue in order and are never dropped; a waiting stop is always written first. (Before v2.1 a burst like `i1 o20 m1` could lose `o20`; caught by a unit test.)

Car buttons: **A** = calibrate compass (motors held off; the firmware never reads the heading before this, because MakeCode's `compassHeading()` starts the calibration game by itself). **B** = emergency stop.

Sound: firmware v2.1 calls `pins.setAudioPinEnabled(false)` and `music.setBuiltInSpeakerEnabled(true)` (verified in the pxt-microbit source) so tones play on the built-in speaker only and never on P0 (a wheel pin) or P1/P2 (ultrasonic).

## Firmware v2.2 additions

**Heading-hold steps** (`f`/`b`): the car locks its compass heading and every 20 ms speeds one wheel and slows the other in proportion to the error (`STEP_KP` 12 speed units per degree, capped at 300). Turning rate follows (left − right) in both directions of travel, so the same correction works forward and back. Distance: the ultrasonic gap to whatever is ahead shrinks (forward) or grows (back) by the step length; with nothing within 300 cm the step is timed from `STEP_CM_PER_S` (25 cm/s at speed 700, TO VALIDATE per car). Ends: done, obstacle (never closer than 10 cm or the set obstacle stop), lifted, time cap, or cancelled by any drive letter / STOP / button / link loss. Result: `S:<cm>,<d|o|l|t|x>`.

**Runtime wheel flip** (`r`): before v2.2 the app's "Reverse wheels" swapped letters on the phone, so the firmware never knew and its forward-only logic (obstacle stop, steps) looked the wrong way on such cars. From v2.2 the app sends `r1` instead and stops swapping, so every sensor rule works in the car's real directions. The app decides from the live `C:` reply only, never from saved data, so an older car can never end up unswapped. Board B already has `FLIP = true` compiled; leave its Reverse wheels off.

Both boards now have `HAS_ULTRASONIC = 1` (owner, Nov 22 2026).
