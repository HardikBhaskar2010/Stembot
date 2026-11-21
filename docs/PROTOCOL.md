# STEMBOT car protocol (app side)

Source of truth: firmware v2.0 (`stembot_fw_boardA.ts`, `stembot_fw_boardB.ts` in the repo root) and the GATT log from the real car (Nov 2026). Code: `src/protocol/`.

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
