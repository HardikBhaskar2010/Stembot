# Product

<!-- impeccable:product-schema 1 -->

> Source: written from the owner's brief (Nov 2026). The owner asked not to be interviewed unless blocked, so every fact below comes from that brief or the measured STEMBOT pin-map notes. Items marked _(inferred)_ are my reading of the brief, not confirmed answers.

## Platform

adaptive _(inferred: one React codebase shipped as a web PWA and as Capacitor Android/iOS apps; the design language is shared, not per-OS native)_

## Stack

delegated with constraints: React + TypeScript + Vite, Zustand store, Capacitor for Android/iOS, Web Bluetooth on the web, `@capacitor-community/bluetooth-le` natively. No backend, no accounts, no analytics, no network after install.

## Users

- **Student driver (primary)**, roughly 9 to 15 _(inferred age)_, with one or two micro:bit robot cars on a floor or table, phone or laptop in hand. Wants to drive now, not read.
- **Parent or teacher helper**, sets the cars up, names them, fixes "it won't connect". Not a developer.
- **Maker / developer (secondary)**, flashes MakeCode firmware, debugs telemetry. Served only behind "Enable dev options".

## Product Purpose

Connect to one or more STEMBOT micro:bit V2 cars over Bluetooth and drive them safely, alone or as a group. Success: a first-time user connects and drives within 30 seconds without explanation, and a car never keeps moving when the user lets go, switches away, or loses the link.

## Positioning

A controller that treats stopping as the main feature: per-car newest-command-wins links with a keep-alive matched to the car's 250 ms watchdog, lift detection, and group drive where one car's failure never blocks the others.

## Operating Context

- Cars: BBC micro:bit V2 on a STEMROBO BMBRK V1.1 board, MakeCode firmware with the Bluetooth UART service, "No Pairing Required".
- Used on a floor or table, often with the phone held in two hands (dual thumbs) or on a laptop with a keyboard.
- Hardware known quirks: some cars have no ultrasonic (cm = 0), some have wheels wired backwards, Bluetooth drops when the micro:bit is under-powered.

## Capabilities and Constraints

- Protocol is fixed by current firmware (see `docs/PROTOCOL.md`). Honk, locate and capability handshake need a firmware change and are gated on the car reporting the capability.
- No battery telemetry exists. Any "battery" hint must be derived from link drops and labelled as a hint.
- iOS Safari has no Web Bluetooth; iPhone users need the Capacitor app.
- Follow-the-leader and formations: future work, undecided.

## Brand Commitments

- Name: **STEMBOT Control**.
- Look pinned by the owner: cinematic, sci-fi, cyberpunk, premium, interactive. Dark base, restrained neon cyan plus a second accent, glass or depth only where it earns its place, crisp typography, purposeful motion. Must read as a product, not a dev tool.
- Voice: plain language. "Car A lost connection", never "GATT server disconnected".

## Evidence on Hand

- Measured pin map and GATT behaviour from the owner's board (stembot-pin-map notes, Nov 2026).
- No photos, logos, testimonials or user research exist. Do not invent any.

## Product Principles

1. Stopping beats moving: every path out of a control sends stop.
2. One primary action per screen; drive within 30 seconds.
3. Say what the car is doing in words a 10-year-old understands.
4. Every car is independent: one failure never stalls the group.
5. Be honest about limits (drift, missing sensors, hints vs. measurements).

## Accessibility & Inclusion

WCAG 2.2 AA target: keyboard and screen-reader operable, 4.5:1 text contrast, 44 px minimum targets (STOP much larger), no colour-only signals, `prefers-reduced-motion` honoured.
