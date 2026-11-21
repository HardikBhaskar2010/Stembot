# Plan: firmware v2.1 (compass, accelerometer, sounds) + app compass + voice commands

Status: **approved (clap commands, no seek mode) and implemented** on Nov 22, 2026. See docs/PROTOCOL.md (v2.1) and docs/TEST_CHECKLIST.md section G for what still needs a real car.
Labels: VERIFIED (checked in official docs today), TO VALIDATE (only a real car / the MakeCode editor can tell).

## 0. Safety gate first: where does the sound go?

VERIFIED (makecode.microbit.org `pins.analogSetPitchPin`): the pitch pin can only be **P0, P1 or P2**. On this board P0 is a **wheel pin** (right wheel back) and P1/P2 are the **ultrasonic** pins. The v2.0 firmware calls `analogSetPitchPin(AnalogPin.P12)`, which the docs do not list as valid, so tones may still be driven onto P0.

Step 0, before any new sound: read the `pxt-microbit` source for V2 audio routing (built-in speaker only, pin output off; e.g. `pins.setAudioPinEnabled` / `music.setBuiltInSpeakerEnabled`, names NOT yet verified) and use the speaker-only route. If no speaker-only route exists, sounds ship **off by default** and the checklist's first test is "wheels off the ground, play every sound, no wheel twitch".

## 1. Firmware v2.1 (one shared code body; Board A and B differ only in the constants)

| Constant | Board A | Board B |
|---|---|---|
| `FLIP` | false | true |
| `HAS_ULTRASONIC` | 1 | 0 |
| `HAS_COMPASS` (new) | 1 | 1 |

**Protocol additions** (all lines stay ≤ 20 bytes; old app versions ignore them):

| Direction | Text | Meaning |
|---|---|---|
| car → app | `C:2.1,<us>,<horn>,<compass>` | capability reply gets a 4th field (app accepts 3 or 4) |
| car → app | `M:<heading>,<pitch>,<roll>,<bump>` | ~6.7 Hz, interleaved with `D:`. heading 0–359 or `-1` = not calibrated; pitch/roll −180..180 (VERIFIED range); bump 1 = jolt since last line. Max `M:359,-180,-180,1\n` = 18 bytes |
| app → car | `m1` / `m0` | car sounds on / off (default on, resets on disconnect, re-sent with `i`/`o`) |

**Compass.** VERIFIED: `input.compassHeading()` starts the tilt-to-calibrate game on first use and returns −1003 when not ready. A blocking calibration game must never start while the car may be driving, so:
- **Button A** = calibrate compass: stop motors, ignore drive letters while calibrating, run `input.calibrateCompass()`, then mark the compass ready. Until then `M:` reports heading `-1` and the firmware never calls `compassHeading()`.
- TO VALIDATE: whether calibration survives a reboot (if not, press A once per power-on), and how much the DC motor magnets bend the reading. The app labels heading as approximate.

**Accelerometer.** Bump = `input.acceleration(Dimension.Strength)` above ~2200 mg (VERIFIED API, units milli-g; threshold TO VALIDATE). Pitch/roll go out raw in `M:`. `Gesture.ThreeG` is not used because its enum name is unverified.

**Sounds** (short, background fiber, never block the motor loop, skipped if one is already playing, muted by `m0`):

| Event | Sound (tones, ms) |
|---|---|
| Boot | rising arpeggio C5–E5–G5–C6, 60 ms each, sparkle on top |
| Link up | quick up-chirp A5→E6 |
| Link lost | down-chirp G5→C5 (after the motors stop) |
| Lifted | short upward sweep |
| Landed | soft two-note blip |
| Obstacle stop triggered | double beep (once per stop, edge-triggered) |
| Bump | low "thud" G3→D3 |
| Compass calibrated | three-note success |
| Honk / locate | as v2.0 |

Unchanged: watchdog 250 ms, stop on disconnect, button B stop, `i`/`o` semantics, telemetry `D:` format.

### Clap mode (car microphone)

The V2 microphone gives a loudness level and loud/quiet events only (MakeCode `input.soundLevel()`, `input.onSound(...)`: names to be confirmed in the pxt-microbit source in step 0). One omnidirectional microphone cannot tell **where** a sound comes from, so "drive toward the clap" is not physically possible. Instead:

- **Clap commands** (planned): app toggles clap mode per car with `k1` / `k0` (default off, resets on disconnect). Claps are counted in a ~1 s window: **1 clap = forward ~1 s, 2 claps = turn right 90° (compass-assisted when calibrated, timed otherwise), 3 claps = turn around 180°**. Motors are stopped while listening so their noise is not counted.
- **Seek the sound** (optional, experimental, only if approved): rotate in 8 compass steps, listen ~400 ms at each with motors off, face the loudest step, drive ~1 s. Needs a continuous sound (whistle, music); unreliable with echoes.
- Safety while the car moves by itself: every move is bounded (≤ 1 s or one turn), lift stop and obstacle stop (where there is a sensor) are forced on in clap mode, button B and app STOP still work, and the mode switches off and stops the car on link loss.
- Telemetry: `M:` gains nothing; a clap event is reported as `K:<claps>` so the app can show "Heard 2 claps".

## 2. App changes

1. **Parser** (`src/protocol/telemetry.ts`): `M:` line with strict ranges; `C:` with 3 or 4 fields; unit tests for valid and malformed input.
2. **Compass on Drive**: a small compass dial in the radar card (needle + "NE 42°"), calm and readable; `-1` shows "Compass not calibrated: press A on the car and tilt it until the screen fills". Per-car **"Set current direction as north"** (stores an offset, since the micro:bit mounting is unknown). Hidden for cars without the capability.
3. **Group drive**: each car row shows its heading, so drift between cars becomes visible.
4. **Bump**: phone haptic + a brief flash on that car's radar; no toast spam.
5. **Car sounds**: Settings → "Car sounds" (on/off, default on) → `m1`/`m0`, re-sent ~300 ms after every (re)connect with `i`/`o`.
5b. **Clap mode**: per-car switch "Clap commands" (default off) in the car card/editor → `k1`/`k0`, re-sent after reconnect; Drive shows "Listening for claps" and the last clap count.
6. **Dev options**: raw and parsed `M:`, the 4-field `C:` reply, last `m` sent.
7. **Voice commands** (new, off by default, Settings → "Voice commands"):
   - **Push-to-talk** mic button on Drive and Group (hold to listen). Never always-listening.
   - Vocabulary (English first, strings in `en.ts`): *stop / halt* → STOP all, acted on the **partial** result for speed; *forward / go*, *back*, *left*, *right* → a bounded move of **1 s** then stop (say it again to keep going); *spin left / right*; *faster / slower*; *slow / normal / turbo*; *honk*; *find me / locate*; *lock*. No "unlock" by voice (safety).
   - **Decision: on-device only.** The mic button is hidden where on-device recognition is unavailable (no audio leaves the device). Engines: web = Web Speech API (VERIFIED: exists; Chrome-style engines may send audio to a server unless `processLocally = true`; on-device needs a language pack via `available()` / `install()`). Native = `@capacitor-community/speech-recognition` 7.0.1 (peer `@capacitor/core >= 7`, so compatible with 8; VERIFIED: no option to force on-device; needs `RECORD_AUDIO` on Android and `NSSpeechRecognitionUsageDescription` + `NSMicrophoneUsageDescription` on iOS).
   - `vercel.json` Permissions-Policy: `microphone=(self)` (today it is `microphone=()`).
   - Voice is a convenience, never a safety control: recognition takes ~0.5–1.5 s, so the on-screen STOP stays primary and the UI says so.
8. **Mock car**: simulated heading (turns while spinning), `M:` lines, occasional bump, `m` handling, `C:2.1,…`; car 4 starts uncalibrated to test the hint.

## 3. Tests

- Unit: `M:`/`C:` parsing (valid, out of range, garbage), `m` encoding, voice phrase matcher (synonyms, "stop" priority, partial results, unknown phrases ignored), heading offset maths.
- E2E (mock): compass dial shows a heading and the uncalibrated hint; voice via a test hook that injects transcripts ("stop" stops all, "forward" moves ~1 s then stops); Car sounds sends `m0`.
- Firmware: can't be compiled or run here (no MakeCode toolchain); TO VALIDATE in the MakeCode editor, then on the car.

## 4. Order of work

1. Step 0 audio routing check → 2. firmware v2.1 (A and B) → 3. parser + mock + unit tests → 4. compass UI + car sounds + dev view → 5. voice commands → 6. e2e, docs (protocol, firmware notes, checklist), full checks → 7. commit, push (Vercel redeploys `main`), new APK from GitHub Actions.

## 5. Risks

1. Tones on P0 twitching a wheel (step 0).
2. Compass accuracy near motors; mounting orientation (offset button helps, can't fix magnetism).
3. Voice privacy: cloud recognition sends audio off the device, which conflicts with "no network calls" unless on-device is required.
4. Voice latency: never use it to stop in an emergency.
5. Calibration game blocking: handled by calibrating only on button A with motors forced off.

## 6. Decisions (Nov 22, 2026)

1. Voice recognition: **on-device only** (assumed; the owner did not pick, reversible).
2. Compass calibration: **button A on the car** (owner).
3. Bump: **sound + phone haptic**, no stop (owner).
4. Car sounds: **on by default** (owner).
5. Clap: owner asked for "follow the clap when toggled in the app". One microphone cannot locate sound, so the plan offers **clap commands** (recommended) and an optional experimental **seek the sound**; awaiting the owner's pick.
