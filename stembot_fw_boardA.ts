// STEMBOT firmware v2.0, Bluetooth UART. Newest command wins.
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
// Telemetry out every ~150 ms: "D:<cm>,<irL>,<irR>,<air>"  (cm 0 = no echo, air 1 = lifted)
// Capabilities out on "?": "C:<version>,<hasUltrasonic>,<hasHorn>"

// FIRST: drive every wheel pin low so nothing floats and spins at boot.
pins.digitalWritePin(DigitalPin.P0, 0)
pins.digitalWritePin(DigitalPin.P8, 0)
pins.digitalWritePin(DigitalPin.P15, 0)
pins.digitalWritePin(DigitalPin.P16, 0)

// ---- per-board settings -------------------------------------------------
const FLIP = false               // true = reverse both wheels (wheels wired the other way)
const HAS_ULTRASONIC = 1       // 1 if this car has a working ultrasonic sensor, else 0
const HAS_HORN = 1                  // micro:bit V2 has a built-in speaker
const FW_VERSION = "2.0"
// -------------------------------------------------------------------------

const TRIG = DigitalPin.P1
const ECHO = DigitalPin.P2
const IR_L = DigitalPin.P14
const IR_R = DigitalPin.P13
const WATCHDOG_MS = 250      // stop if no drive letter for this long
const AIR_CONFIRM = 3        // passes in a row both IR must read 1 before "airborne"
const TELEMETRY_EVERY = 6    // loop passes between telemetry sends

let speed = 700              // 0-1023
let cmd = "x"                // newest command: w s a d x
let lastRx = 0
let applied = ""
let appliedSpeed = -1
let linked = false
let airborne = false
let airCount = 0
let tickCount = 0
let lastCm = 0
let obstacleStopCm = 0       // 0 = off
let busyFx = false
let liftStop = false         // false = keep driving when lifted (telemetry still reports it)

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

function showLinkIcon() {
    if (linked) {
        basic.showIcon(IconNames.Yes)
    } else {
        basic.showIcon(IconNames.Asleep)
    }
}

function sendCapabilities() {
    // "C:2.0,1,1\n" is 10 bytes, under the 20-byte limit
    bluetooth.uartWriteString("C:" + FW_VERSION + "," + HAS_ULTRASONIC + "," + HAS_HORN + "\n")
}

// Sounds and LEDs run in the background so the motor loop and the UART handler never block.
function honk() {
    if (busyFx) {
        return
    }
    busyFx = true
    control.inBackground(function () {
        music.playTone(523, 120)
        music.playTone(659, 160)
        busyFx = false
    })
}

function locate() {
    if (busyFx) {
        return
    }
    busyFx = true
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

stopAll()
// Send sound to P12 (free pin), NOT P0, because P0 is a wheel pin. TO VALIDATE: wheels must not twitch on honk.
pins.analogSetPitchPin(AnalogPin.P12)
pins.setPull(DigitalPin.P14, PinPullMode.PullNone)
pins.setPull(DigitalPin.P13, PinPullMode.PullNone)
pins.analogSetPeriod(AnalogPin.P0, 1000)
pins.analogSetPeriod(AnalogPin.P8, 1000)
pins.analogSetPeriod(AnalogPin.P15, 1000)
pins.analogSetPeriod(AnalogPin.P16, 1000)
stopAll()

bluetooth.startUartService()
basic.showIcon(IconNames.Asleep)

bluetooth.onBluetoothConnected(function () {
    linked = true
    basic.showIcon(IconNames.Yes)
})

bluetooth.onBluetoothDisconnected(function () {
    linked = false
    cmd = "x"
    obstacleStopCm = 0
    liftStop = false
    stopAll()            // link lost: stop right away
    basic.showIcon(IconNames.Asleep)
})

// Fires when a newline arrives. One command per line.
bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let s = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    if (s.length == 0) {
        return
    }
    let c = s.charAt(0).toLowerCase()
    if (c == "w" || c == "a" || c == "s" || c == "d") {
        if (s.length > 1) {
            let v = parseInt(s.substr(1, s.length - 1))
            if (v >= 200 && v <= 1023) {
                speed = v
            }
        }
        if (!(liftStop && airborne)) {   // lift-off stop on and car lifted: ignore drive commands
            cmd = c
            lastRx = control.millis()
        }
    } else if (c == "x" || c == " ") {
        cmd = "x"
        lastRx = control.millis()
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
        if (s.length > 1 && s.charAt(1) == "1") {
            liftStop = true
        } else {
            liftStop = false
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

// One loop: read sensors, enforce cutoffs and watchdog, apply newest command, send telemetry.
basic.forever(function () {
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
    if (liftStop && airborne) {
        cmd = "x"
    }

    if (cmd != "x" && control.millis() - lastRx > WATCHDOG_MS) {
        cmd = "x"
    }

    // Distance: every pass while the obstacle stop is on, otherwise only when a telemetry line is due.
    tickCount += 1
    let sendNow = linked && tickCount % TELEMETRY_EVERY == 0
    if (obstacleStopCm > 0 || sendNow) {
        lastCm = distanceCm()
    }

    // Forward obstacle stop. cm 0 (no echo / no sensor) never stops the car.
    let eff = cmd
    if (eff == "w" && obstacleStopCm > 0 && lastCm > 0 && lastCm < obstacleStopCm) {
        eff = "x"
    }
    apply(eff)

    if (sendNow) {
        let a = 0
        if (airborne) {
            a = 1
        }
        bluetooth.uartWriteString("D:" + lastCm + "," + irL + "," + irR + "," + a + "\n")
    }
    basic.pause(20)
})

input.onButtonPressed(Button.B, function () {
    cmd = "x"
    stopAll()            // emergency stop
})
