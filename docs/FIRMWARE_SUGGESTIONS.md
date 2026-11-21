# Firmware suggestions (MakeCode, micro:bit V2)

> **Status (firmware v2.0 in the repo root):** suggestions 1 (ignore unknown letters), 2 (capability handshake), 3 (honk and locate) and 4 (obstacle stop, `o<cm>`) are implemented by the owner, plus a new lift-off stop toggle (`i1`/`i0`, default off). The app supports all of them. Still TO VALIDATE on the car: honk on P12 must not twitch the wheels (noted in the firmware).


Nothing here has been flashed. I have **not seen your firmware source**; the snippets assume the structure described in the brief and the pin-map notes: a `bluetooth.onUartDataReceived(NewLine)` handler that stores the newest command, one `basic.forever` loop that applies it every 20 ms, a 250 ms watchdog, and a `D:` telemetry line every ~150 ms. Merge them by hand into that structure and keep the existing safety behaviour (watchdog, disconnect stop, button B stop, lift stop).

Labels: **OBSERVED** (seen on the car), **INFERRED** (deduced), **HYPOTHESIZED** (best guess), **TO VALIDATE** (must be tested on the car).

Ranked by value to the app.

---

## 1. Treat unknown letters as "ignore", never as "drive"

**Why.** The app already sends `?` once after connecting. If the current parser resets the watchdog or changes motion for any letter, an unknown letter could matter. INFERRED: most parsers check `w/s/a/d/x/q/e` explicitly, so `?` is probably ignored. **TO VALIDATE.**

**Change.** In the UART handler, only the drive letters may refresh the watchdog:

```ts
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    const line = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    if (line.length == 0) return
    const c = line.charAt(0)
    if (c == "w" || c == "s" || c == "a" || c == "d") {
        if (airborne) return            // lifted: ignore drive letters (existing rule)
        cmd = c
        const v = parseInt(line.substr(1))
        if (v >= 200 && v <= 1023) speed = v
        lastDriveMs = input.runningTime()
    } else if (c == "x" || c == " ") {
        cmd = "x"
    } else if (c == "?") {
        sendCapabilities()               // suggestion 2
    } else if (c == "h") {
        honk()                           // suggestion 3
    } else if (c == "l") {
        locate()                         // suggestion 3
    }
    // anything else: ignored on purpose
})
```

**Risk.** Low. Same behaviour for existing letters.
**Test.** Wheels off the ground. In the app's Dev options → Console, send `?`, `z`, `hello`: the car must not move and must keep stopping 250 ms after you release a drive control.

---

## 2. Capability handshake: `?` → `C:<version>,<hasUltrasonic>,<hasHorn>`

**Why.** Lets the app hide or enable features per car (honk, locate, distance radar) instead of guessing. The app already parses this line and gates Honk/Locate on `hasHorn`. Cars that never answer keep working exactly as today.

**Change.**

```ts
const FW_VERSION = "2.0"
const HAS_ULTRASONIC = 1   // set to 0 on cars without a working sensor
const HAS_HORN = 1         // micro:bit V2 has a built-in speaker

function sendCapabilities() {
    // "C:2.0,1,1\n" is 10 bytes, under the 20-byte limit
    bluetooth.uartWriteString("C:" + FW_VERSION + "," + HAS_ULTRASONIC + "," + HAS_HORN + "\n")
}
```

Optional auto-detect (HYPOTHESIZED to be useful): if the first 20 pings after boot all return 0, report `hasUltrasonic = 0`. This can't tell "nothing in range" from "no sensor" in an empty room, so keep the constant as the override.

**Risk.** Low. One extra 10-byte write per connection. If it collides with a telemetry write in the same tick, MakeCode serialises them (INFERRED).
**Test.** Dev options → Live data shows `capabilities: { version: "2.0", … }` within a second of connecting; Honk becomes enabled in the command palette.

---

## 3. Honk and locate-me

**Why.** Honk is fun; locate is useful in a group ("which one is Comet?"). Both are cheap on V2.

**Change.** Run sounds and LEDs in the background so the UART handler and the motor loop never block:

```ts
let busyFx = false

function honk() {
    if (busyFx) return
    busyFx = true
    control.inBackground(function () {
        music.playTone(523, 120)
        music.playTone(659, 160)
        busyFx = false
    })
}

function locate() {
    if (busyFx) return
    busyFx = true
    control.inBackground(function () {
        for (let i = 0; i < 3; i++) {
            basic.showIcon(IconNames.Target, 0)
            music.playTone(880, 100)
            basic.clearScreen()
            basic.pause(120)
        }
        busyFx = false
    })
}
```

**Risk.** Medium. `music.playTone` and `basic.showIcon` block their fiber; in `control.inBackground` they should not stall the motor loop (INFERRED from MakeCode's fiber model). If you mirror IR readings on the LEDs (the debugging trick from the notes), `locate` will overwrite them briefly. The speaker draws current: on weak batteries this could contribute to the Bluetooth drops seen before (HYPOTHESIZED).
**Test.** Wheels off. Hold forward in the app, trigger Honk from the command palette: the wheels must keep turning without a stutter longer than one keep-alive, and releasing must still stop within 250 ms.

---

## 4. Automatic obstacle stop (configurable)

**Why.** A safety net for younger drivers: forward motion stops when something is close in front.

**Change.** New command `o<cm>` (`o0` disables). Apply it in the existing motor loop, forward only:

```ts
let obstacleStopCm = 0   // 0 = off (default, so existing behaviour is unchanged)

// in the UART handler:
//   else if (c == "o") { const v = parseInt(line.substr(1)); obstacleStopCm = (v >= 10 && v <= 100) ? v : 0 }

// in the motor loop, before applying cmd:
if (cmd == "w" && obstacleStopCm > 0 && cm > 0 && cm < obstacleStopCm) {
    cmd = "x"
}
```

**Risk.** Medium. From the notes: the sensor can't read below ~2–3 cm, stop distances under ~8 cm are unreliable, and it misses table corners (OBSERVED). So the minimum is clamped to 10 cm and the feature must be described as "helps", never "prevents crashes". `cm == 0` (no echo) must not trigger a stop, or cars without a sensor could never drive.
**Test.** Wheels on a clear floor, `o30`. Drive slowly at a box: stops at ~30 cm. Repeat with a table leg and an angled surface; write down misses. Then `o0` and confirm normal driving.

The app does not send `o` yet; adding a Settings control is a small follow-up once the firmware supports it.

---

## 5. Battery / supply voltage hint — not recommended with this board

**Why considered.** The garage shows a "Check batteries" hint today, derived from link drops (that link drops follow under-powering is OBSERVED in the notes).

**Finding.** MakeCode has no supported API that reads the micro:bit V2 supply voltage (INFERRED from the standard blocks; I found no such block). Measuring the motor battery would need a resistor divider into a free analog pin (P12 is free per the pin map), which is a hardware change, and the divider ratio and pack voltage are unknown. **Can't be read reliably as-is.** Keep the link-drop hint and its "hint, not a measurement" wording.

---

## 6. Compact binary telemetry — not needed

**Finding.** The text line is ~12 bytes at ~6.7 Hz ≈ 80 bytes/s per car (OBSERVED format and rate). BLE throughput is far above this even with indications (INFERRED). A binary format would save bytes nobody is short of and make debugging harder (the raw stream in Dev options stays readable today). Revisit only if a measured telemetry rate in Dev options drops well below ~6/s with 4 cars connected.

---

## 7. Small robustness items

- **Telemetry while lifted.** Keep sending `D:` lines while airborne so the app can show "Lifted" (OBSERVED working).
- **Reply on connect.** Optionally send one `D:` line immediately on connect so the radar fills without waiting 150 ms (INFERRED harmless).
- **FLIP vs app reverse.** If `FLIP` is set in firmware, leave the app's "Reverse wheels" off for that car, or they cancel out.
