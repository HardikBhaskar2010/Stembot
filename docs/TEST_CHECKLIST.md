# Manual test checklist (real cars)

Everything below needs real hardware and was **not** tested by me. Do every first test with the **wheels off the ground** (car on a box or upside down on a cloth). Keep a finger near the power switch. The MOTOR_PWR jumper is the hard stop.

Write down pass/fail and the phone/browser model for each line.

## A. One car, web (Chrome or Edge, desktop or Android)

1. [ ] Open the app over `https://` (or `http://localhost`). Add car → **Find my car** → chooser lists `BBC micro:bit [xxxxx]` → pick it → name screen appears within ~5 s.
2. [ ] **Start driving**: radar shows a distance (or "No echo" on a car without a sensor), never "0 cm".
3. [ ] Hold **W** (desktop) or drag the joystick up: both wheels turn forward. Let go: wheels stop **immediately** (well under half a second).
4. [ ] Hold for 10 s continuously: wheels never stutter or stop by themselves (keep-alive works).
5. [ ] Hold forward, then **Alt+Tab** / switch tab / lock the phone: wheels stop.
6. [ ] Hold forward, press **Space**: stops. Tap the big **STOP**: stops.
7. [ ] Nudge forward / back: about 0.3 s of movement, then stop. Spin left / right: about 0.45 s.
8. [ ] Slow / Normal / Turbo while holding: speed changes without stopping.
9. [ ] **Lock controls**: driving does nothing, STOP still works; unlock needs a ~0.6 s press.
10. [ ] **Stop when lifted OFF (default)**: pick the car up while driving: wheels keep turning, app shows "Lifted (still drivable)". Release: wheels stop.
10b. [ ] Turn **Stop when lifted ON** (car card or Settings → Cars): Dev options shows `i1`. Lift while driving: wheels stop, app shows "Lifted: stopped", driving does nothing. Put it down: driving works again.
10c. [ ] With it ON, switch the car off and on, reconnect: Dev options shows `i1` again and lifting still stops it (firmware reset it; the app re-sent it).
10d. [ ] Turn it OFF: the one-time warning appears once, never again.
10e. [ ] Obstacle stop 30 cm (Board A only; hidden on Board B, which has no sensor): drive slowly at a box, it stops near 30 cm. Try a chair leg and a corner and note misses.
11. [ ] Switch the car off while holding forward: app says "{name} lost connection" within ~2 s; Reconnect works after switching it on.
12. [ ] Reload the page, tap **Connect** on the card: reconnects (on Chrome without `getDevices()` the chooser opens again — expected).
13. [ ] Dev options → Console: send `?`. Car must not move. Dev options → Live data: telemetry rate about 6–7 /s.

## B. Reverse wheels and speed

14. [ ] Board B already has firmware `FLIP = true`: keep the app's **Reverse wheels OFF** for it and check forward is forward. Turning Reverse wheels on should make it drive backwards (they cancel out).
15. [ ] Car speed slider at 200 and at 1023: slow and fast respectively; nothing below 200 is sent (check Dev options → Commands).

## C. Two to four cars (group)

16. [ ] Connect 2 cars → **Group drive** → hold forward: both move. Release: both stop.
17. [ ] Untick one car: only the other moves.
18. [ ] Car 1 with Stop when lifted ON, car 2 OFF. Lift car 1 while driving the group: car 1 stops ("Lifted: stopped"), car 2 keeps moving. Lift car 2: it keeps driving ("Lifted (still drivable)"), car 1 unaffected.
19. [ ] Switch car 2 off while driving: car 2 shown as lost; car 1 still drives and stops normally.
20. [ ] Tune: different speeds per car reduce drift on a 2 m straight line. (They will still drift: no feedback between cars.)
21. [ ] With 3–4 cars: Dev options → Live data per car shows avg write time and "Replaced" counts; release still stops all cars at once. Note any car that lags.

## D. Android app (Capacitor)

22. [ ] First launch: Android asks for **Nearby devices** (Android 12+) — no location prompt. On Android 11 or older it asks for location (system rule).
23. [ ] Deny permission → app shows "STEMBOT needs Bluetooth permission". Allow in settings → Try again works.
24. [ ] Bluetooth off → "Bluetooth is off".
25. [ ] Repeat A3–A11 in the app. Press the Home button while driving: car stops.
26. [ ] Shake the phone hard twice (Settings → Shake phone to stop all on): all cars stop.
27. [ ] Kill the app from recents while driving: car stops (firmware watchdog + link loss).

## E. iOS app (needs a Mac to build)

28. [ ] Bluetooth permission prompt shows the text "STEMBOT Control uses Bluetooth…".
29. [ ] Repeat A1–A11. Switch to another app while driving: car stops.
30. [ ] Shake to stop: iOS asks for motion access when the toggle is turned on.

## F. PWA install and offline

31. [ ] Chrome: install the app (address-bar install icon). Turn on airplane mode except Bluetooth, open the installed app: it loads and drives.

## G. Firmware v2.1 (compass, sounds, claps). Flash v2.1 to both boards first

32. [ ] MakeCode: paste `stembot_fw_boardA.ts` into a project with the Bluetooth extension; it compiles. Same for Board B. (Not compiled by me: no MakeCode toolchain here.)
33. [ ] **Wheels off the ground.** Power on: boot sound from the built-in speaker; **no wheel twitches** during any sound (connect, honk, locate, bump). If a wheel twitches, stop and report: audio is reaching a pin.
34. [ ] Connect: link-up chirp. Switch the app off: link-lost sound, wheels stopped.
35. [ ] Settings → Car sounds off: no event sounds; Honk still plays. Reconnect: still muted (the app re-sends `m0`).
36. [ ] Compass: Drive shows "Compass not set up". Press **A**, tilt the car until the screen fills: motors stay off throughout, success sound, Drive shows a heading. Spin the car: the dial follows.
37. [ ] Compass accuracy with motors running: note how far the heading jumps when the wheels spin (motor magnets). Use "Set current direction as north" in the car's settings.
38. [ ] Bump: push the car into a soft obstacle at Normal speed: thud sound, phone buzzes, radar flashes "Bump!". Tune `BUMP_MG` (2200) if it fires on normal driving or never fires.
39. [ ] Clap commands on (car settings): chirp. One clap: forward ~1 s and stop. Two: turn right (~90° if the compass is calibrated, timed otherwise). Three: turn around. Tune `CLAP_LEVEL` (150) for the room.
40. [ ] Clap safety: lift the car during a clap move: it stops. Clap toward a wall: it stops at ~25 cm (Board A). App STOP and button B end a clap move. Disconnect: clap mode is off after reconnect unless the switch is on.
41. [ ] Motor noise and the car's own sounds must not count as claps (drive with clap mode on; no unexpected moves).
42. [ ] Voice (Chrome/Edge desktop with on-device speech): Settings → Voice commands on. If it offers a download, download the English pack. Hold "Hold to talk", say "forward": the car moves ~1 s. Say "stop" mid-move: it stops as you say it. On browsers without on-device speech, the switch explains and stays off.
