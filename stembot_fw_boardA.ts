// STEMBOT firmware v2.1, Bluetooth UART. Newest command wins.
// BOARD: Board A (first car, normal wheel direction)
// Right: P8 fwd / P0 back. Left: P16 fwd / P15 back.
// Ultrasonic: TRIG P1, ECHO P2. Bottom IR: left P14, right P13 (reads 1 = no floor).
//
// Commands in (one per line, max 20 bytes):
//   w s a d  drive, optionally followed by a speed 200-1023, e.g. "w700"
//   x or space  stop      q / e  speed down / up by 100
//   ?  reply with capabilities    h  honk    l  locate (flash + beep)
//   o<cm>  forward obstacle stop at <cm> (10-100), o0 = off
//   i1 / i0  lift-off stop on / off (default OFF: the car drives even when lifted)
//   m1 / m0  car sounds on / off (default ON)
//   k1 / k0  clap commands on / off (default OFF): 1 clap = forward 1 s,
//            2 claps = turn right 90 degrees, 3 claps = turn around
//   o, i, m and k all reset to their defaults when the link drops.
// Out, about every 150 ms each:
//   "D:<cm>,<irL>,<irR>,<air>"            (cm 0 = no echo, air 1 = lifted)
//   "M:<heading>,<pitch>,<roll>,<bump>"   (heading -1 until the compass is calibrated)
// Out on events: "C:<version>,<hasUltrasonic>,<hasHorn>,<hasCompass>" on "?",
//                "K:<claps>" when a clap command starts.
// Buttons: A = calibrate compass (tilt to fill the screen; motors are held off), B = emergency stop.

// FIRST: drive every wheel pin low so nothing floats and spins at boot.
pins.digitalWritePin(DigitalPin.P0, 0)
pins.digitalWritePin(DigitalPin.P8, 0)
pins.digitalWritePin(DigitalPin.P15, 0)
pins.digitalWritePin(DigitalPin.P16, 0)

// ---- per-board settings -------------------------------------------------
const FLIP = false               // true = reverse both wheels (wheels wired the other way)
const HAS_ULTRASONIC = 1       // 1 if this car has a working ultrasonic sensor, else 0
const HAS_HORN = 1                  // micro:bit V2 has a built-in speaker
const HAS_COMPASS = 1               // micro:bit V2 has a compass (magnetometer)
const FW_VERSION = "2.1"
// -------------------------------------------------------------------------

const TRIG = DigitalPin.P1
const ECHO = DigitalPin.P2
const IR_L = DigitalPin.P14
const IR_R = DigitalPin.P13
const WATCHDOG_MS = 250      // stop if no drive letter for this long
const AIR_CONFIRM = 3        // passes in a row both IR must read 1 before "airborne"
const TELEMETRY_EVERY = 6    // loop passes between telemetry sends
const BUMP_MG = 2200         // acceleration strength (milli-g) that counts as a bump. TO VALIDATE on the floor
const CLAP_LEVEL = 150       // microphone "loud" threshold for a clap (0-255). TO VALIDATE in the room
const CLAP_WINDOW_MS = 1000  // claps are counted for this long after the first one
const CLAP_OBSTACLE_CM = 25  // obstacle stop used during clap moves when none is set

let speed = 700              // 0-1023
let cmd = "x"                // newest command from the app: w s a d x
let lastRx = 0
let applied = ""
let appliedSpeed = -1
let linked = false
let airborne = false
let wasAirborne = false
let airCount = 0
let tickCount = 0
let lastCm = 0
let obstacleStopCm = 0       // 0 = off
let obstacleActive = false
let busyFx = false
let liftStop = false         // false = keep driving when lifted (telemetry still reports it)
let soundOn = true
let compassReady = false     // never read the heading before button A calibration
let calibrating = false
let bumped = false
let lastBumpAt = 0
let quietUntil = 0           // ignore the microphone while the car moves or plays a sound
let clapMode = false
let clapCount = 0
let clapWindowEnd = 0
let lastClapAt = 0
let autoCmd = "x"            // a move the car makes by itself after claps: w or d
let autoUntil = 0
let turnTarget = -1          // compass heading to stop turning at, -1 = timed turn

// ---- sounds (built-in speaker only, see setup below) ---------------------
// Each is a list of frequency, duration pairs; frequency 0 = rest.
const SND_BOOT = [523, 60, 659, 60, 784, 60, 1047, 110, 0, 40, 1568, 70]
const SND_LINK_UP = [880, 60, 1319, 110]
const SND_LINK_LOST = [784, 80, 523, 150]
const SND_LIFTED = [523, 40, 784, 40, 1175, 70]
const SND_LANDED = [988, 50, 659, 80]
const SND_OBSTACLE = [1175, 70, 0, 50, 1175, 70]
const SND_BUMP = [196, 60, 147, 110]
const SND_CALIBRATED = [1047, 70, 1319, 70, 1568, 140]
const SND_CLAP_ON = [1319, 50, 1568, 60]
const SND_CLAP_ACK = [1568, 40]
const SND_HONK = [523, 120, 659, 160]

// Plays in the background so the motor loop and the UART handler never block.
// force: play even when car sounds are muted (honk is an explicit request).
function sfx(notes: number[], force: boolean) {
    if (busyFx || (!soundOn && !force)) {
        return
    }
    busyFx = true
    let total = 0
    for (let i = 1; i < notes.length; i += 2) {
        total += notes[i]
    }
    quietUntil = Math.max(quietUntil, control.millis() + total + 250)  // our own sound is not a clap
    control.inBackground(function () {
        for (let j = 0; j + 1 < notes.length; j += 2) {
            if (notes[j] > 0) {
                music.playTone(notes[j], notes[j + 1])
            } else {
                music.rest(notes[j + 1])
            }
        }
        busyFx = false
    })
}

function right(s: number) {
    if (FLIP) {
        s = -s
    }
    if (s >= 0) {
        pins.digitalWritePin(DigitalPin.P0, 0)
        pins.analogWritePin(AnalogPin.P8, s)
    } else {
        pins.digitalWritePin(DigitalPin.P8, 0)
        pins.analogWritePin(AnalogPin.P0, -s)
    }
}

function left(s: number) {
    if (FLIP) {
        s = -s
    }
    if (s >= 0) {
        pins.digitalWritePin(DigitalPin.P15, 0)
        pins.analogWritePin(AnalogPin.P16, s)
    } else {
        pins.digitalWritePin(DigitalPin.P16, 0)
        pins.analogWritePin(AnalogPin.P15, -s)
    }
}

function stopAll() {
    pins.digitalWritePin(DigitalPin.P0, 0)
    pins.digitalWritePin(DigitalPin.P8, 0)
    pins.digitalWritePin(DigitalPin.P15, 0)
    pins.digitalWritePin(DigitalPin.P16, 0)
}

function apply(c: string) {
    if (c == applied && speed == appliedSpeed) {
        return
    }
    applied = c
    appliedSpeed = speed
    if (c == "w") {
        right(speed)
        left(speed)
    } else if (c == "s") {
        right(-speed)
        left(-speed)
    } else if (c == "a") {
        left(-speed)
        right(speed)
    } else if (c == "d") {
        left(speed)
        right(-speed)
    } else {
        stopAll()
    }
}

function distanceCm(): number {
    pins.setPull(ECHO, PinPullMode.PullNone)
    pins.digitalWritePin(TRIG, 0)
    control.waitMicros(2)
    pins.digitalWritePin(TRIG, 1)
    control.waitMicros(10)
    pins.digitalWritePin(TRIG, 0)
    return Math.idiv(pins.pulseIn(ECHO, PulseValue.High, 25000), 58)   // 0 = no echo
}

function heading(): number {
    // Reading the heading before calibration would start the calibration game mid-drive.
    if (!compassReady || calibrating) {
        return -1
    }
    return input.compassHeading()
}

function angleDiff(a: number, b: number): number {
    let d = Math.abs(a - b) % 360
    return d > 180 ? 360 - d : d
}

function showLinkIcon() {
    if (linked) {
        basic.showIcon(IconNames.Yes)
    } else {
        basic.showIcon(IconNames.Asleep)
    }
}

function sendCapabilities() {
    // "C:2.1,1,1,1\n" is 12 bytes, under the 20-byte limit
    bluetooth.uartWriteString("C:" + FW_VERSION + "," + HAS_ULTRASONIC + "," + HAS_HORN + "," + HAS_COMPASS + "\n")
}

function honk() {
    sfx(SND_HONK, true)
}

function locate() {
    if (busyFx || calibrating) {
        return
    }
    busyFx = true
    quietUntil = control.millis() + 1200
    control.inBackground(function () {
        for (let i = 0; i < 3; i++) {
            basic.showIcon(IconNames.Target, 0)
            music.playTone(880, 100)
            basic.clearScreen()
            basic.pause(120)
        }
        showLinkIcon()
        busyFx = false
    })
}

function cancelAuto() {
    autoCmd = "x"
    turnTarget = -1
    clapCount = 0
}

// Start the move for a finished clap count. Every move is bounded in time.
function startClapMove(n: number) {
    let now = control.millis()
    if (linked) {
        bluetooth.uartWriteString("K:" + n + "\n")
    }
    if (n == 1) {
        autoCmd = "w"
        turnTarget = -1
        autoUntil = now + 1000
    } else {
        let deg = n == 2 ? 90 : 180
        autoCmd = "d"
        if (compassReady) {
            turnTarget = (heading() + deg) % 360
            autoUntil = now + 3000           // safety cap if the target is never reached
        } else {
            turnTarget = -1                  // no compass yet: approximate timed turn
            autoUntil = now + (deg == 90 ? 450 : 900)
        }
    }
    quietUntil = autoUntil + 400             // motor noise is not a clap
}

// ---- setup --------------------------------------------------------------
stopAll()
// Sound goes to the built-in speaker only, never to an edge-connector pin:
// P0 is a wheel pin and P1/P2 are the ultrasonic pins (pins.setAudioPinEnabled, V2 only).
pins.setAudioPinEnabled(false)
music.setBuiltInSpeakerEnabled(true)
music.setVolume(150)
input.setSoundThreshold(SoundThreshold.Loud, CLAP_LEVEL)
pins.setPull(DigitalPin.P14, PinPullMode.PullNone)
pins.setPull(DigitalPin.P13, PinPullMode.PullNone)
pins.analogSetPeriod(AnalogPin.P0, 1000)
pins.analogSetPeriod(AnalogPin.P8, 1000)
pins.analogSetPeriod(AnalogPin.P15, 1000)
pins.analogSetPeriod(AnalogPin.P16, 1000)
stopAll()

bluetooth.startUartService()
basic.showIcon(IconNames.Asleep)
sfx(SND_BOOT, false)

bluetooth.onBluetoothConnected(function () {
    linked = true
    basic.showIcon(IconNames.Yes)
    sfx(SND_LINK_UP, false)
})

bluetooth.onBluetoothDisconnected(function () {
    linked = false
    cmd = "x"
    cancelAuto()
    obstacleStopCm = 0
    liftStop = false
    soundOn = true
    clapMode = false
    stopAll()            // link lost: stop right away
    basic.showIcon(IconNames.Asleep)
    sfx(SND_LINK_LOST, false)
})

// Fires when a newline arrives. One command per line.
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let s = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    if (s.length == 0) {
        return
    }
    let c = s.charAt(0).toLowerCase()
    let on = s.length > 1 && s.charAt(1) == "1"
    if (c == "w" || c == "a" || c == "s" || c == "d") {
        if (s.length > 1) {
            let v = parseInt(s.substr(1, s.length - 1))
            if (v >= 200 && v <= 1023) {
                speed = v
            }
        }
        // lift-off stop on and car lifted, or compass calibrating: ignore drive commands
        if (!(liftStop && airborne) && !calibrating) {
            cmd = c
            lastRx = control.millis()
            cancelAuto()     // the app takes over from any clap move
        }
    } else if (c == "x" || c == " ") {
        cmd = "x"
        lastRx = control.millis()
        cancelAuto()
    } else if (c == "q") {
        speed = Math.max(200, speed - 100)
    } else if (c == "e") {
        speed = Math.min(1023, speed + 100)
    } else if (c == "?") {
        sendCapabilities()
    } else if (c == "h") {
        honk()
    } else if (c == "l") {
        locate()
    } else if (c == "i") {
        liftStop = on
    } else if (c == "m") {
        soundOn = on
    } else if (c == "k") {
        clapMode = on
        cancelAuto()
        quietUntil = control.millis() + 400
        if (on) {
            sfx(SND_CLAP_ON, false)
        }
    } else if (c == "o") {
        let v2 = 0
        if (s.length > 1) {
            v2 = parseInt(s.substr(1, s.length - 1))
        }
        if (v2 >= 10 && v2 <= 100) {
            obstacleStopCm = v2
        } else {
            obstacleStopCm = 0
        }
    }
    // anything else: ignored on purpose, and it does not refresh the watchdog
})

// Claps: count loud sounds in a short window; the loop starts the move when it closes.
input.onSound(DetectedSound.Loud, function () {
    let now = control.millis()
    if (!clapMode || calibrating || autoCmd != "x" || cmd != "x" || now < quietUntil) {
        return
    }
    if (now - lastClapAt < 120) {
        return               // one clap rings for a moment: count it once
    }
    lastClapAt = now
    if (clapCount == 0) {
        clapWindowEnd = now + CLAP_WINDOW_MS
    }
    clapCount = Math.min(3, clapCount + 1)
    sfx(SND_CLAP_ACK, false)
})

// One loop: read sensors, enforce cutoffs and watchdog, apply newest command, send telemetry.
basic.forever(function () {
    let now = control.millis()
    pins.setPull(DigitalPin.P14, PinPullMode.PullNone)   // re-assert every pass
    pins.setPull(DigitalPin.P13, PinPullMode.PullNone)
    let irL = pins.digitalReadPin(IR_L)
    let irR = pins.digitalReadPin(IR_R)

    // Airborne = both bottom sensors see no floor for a few passes in a row.
    if (irL == 1 && irR == 1) {
        airCount += 1
    } else {
        airCount = 0
        airborne = false
    }
    if (airCount >= AIR_CONFIRM) {
        airborne = true
    }
    if (airborne != wasAirborne) {
        sfx(airborne ? SND_LIFTED : SND_LANDED, false)
        wasAirborne = airborne
    }
    if (liftStop && airborne) {
        cmd = "x"
    }

    if (cmd != "x" && now - lastRx > WATCHDOG_MS) {
        cmd = "x"
    }

    // Bump: a sharp jolt from the accelerometer.
    let g = input.acceleration(Dimension.Strength)
    if (g > BUMP_MG && now - lastBumpAt > 600) {
        lastBumpAt = now
        bumped = true
        sfx(SND_BUMP, false)
    }

    // Clap window closed: start the move.
    if (clapMode && clapCount > 0 && now >= clapWindowEnd) {
        let n = clapCount
        clapCount = 0
        startClapMove(n)
    }

    // Clap moves are bounded in time; they also end when the car is lifted (always, in
    // clap mode), while calibrating, or (turns) when the compass reaches the target.
    if (autoCmd != "x") {
        if (now >= autoUntil || airborne || calibrating) {
            autoCmd = "x"
        } else if (autoCmd == "d" && turnTarget >= 0 && angleDiff(heading(), turnTarget) < 15) {
            autoCmd = "x"
        }
    }

    // Distance: every pass while an obstacle stop is active, otherwise only when a telemetry line is due.
    tickCount += 1
    let sendD = linked && tickCount % TELEMETRY_EVERY == 0
    let sendM = linked && tickCount % TELEMETRY_EVERY == 3
    let stopCm = obstacleStopCm > 0 ? obstacleStopCm : (autoCmd == "w" ? CLAP_OBSTACLE_CM : 0)
    if (stopCm > 0 || sendD) {
        lastCm = distanceCm()
    }

    // The app's command wins; a clap move only runs while the app is idle.
    let eff = cmd
    if (eff == "x" && autoCmd != "x") {
        eff = autoCmd
    }
    if (calibrating) {
        eff = "x"
    }
    // Forward obstacle stop. cm 0 (no echo / no sensor) never stops the car.
    let blocked = eff == "w" && stopCm > 0 && lastCm > 0 && lastCm < stopCm
    if (blocked) {
        eff = "x"
        if (autoCmd == "w") {
            autoCmd = "x"
        }
        if (!obstacleActive) {
            sfx(SND_OBSTACLE, false)
        }
    }
    obstacleActive = blocked
    apply(eff)

    if (sendD) {
        let a = 0
        if (airborne) {
            a = 1
        }
        bluetooth.uartWriteString("D:" + lastCm + "," + irL + "," + irR + "," + a + "\n")
    }
    if (sendM) {
        // "M:359,-180,-180,1\n" is at most 18 bytes
        let b = 0
        if (bumped) {
            b = 1
        }
        bumped = false
        bluetooth.uartWriteString("M:" + heading() + "," + input.rotation(Rotation.Pitch) + "," + input.rotation(Rotation.Roll) + "," + b + "\n")
    }
    basic.pause(20)
})

input.onButtonPressed(Button.A, function () {
    // Compass calibration: tilt the car until the screen fills. Motors stay off meanwhile.
    if (calibrating) {
        return
    }
    calibrating = true
    cmd = "x"
    cancelAuto()
    stopAll()
    input.calibrateCompass()
    compassReady = true
    calibrating = false
    sfx(SND_CALIBRATED, false)
    showLinkIcon()
})

input.onButtonPressed(Button.B, function () {
    cmd = "x"
    cancelAuto()
    stopAll()            // emergency stop
})
