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
