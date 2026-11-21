# Firmware type-check

`npm run check:firmware` type-checks `stembot_fw_boardA.ts` and `stembot_fw_boardB.ts` against
MakeCode's own API declarations, so errors like `Operator '==' cannot be applied to types '0' and '1'`
show up here (and in CI) before the code is pasted into the MakeCode editor.

- `makecode/libs_*` are copied from [microsoft/pxt-microbit](https://github.com/microsoft/pxt-microbit)
  (MIT License, Copyright (c) Microsoft Corporation): `libs/core`, `libs/bluetooth`, `libs/microphone`
  `shims.d.ts` / `enums.d.ts`, fetched Nov 22, 2026.
- `makecode/extras.d.ts` declares the few APIs that MakeCode defines in TypeScript library files
  (`music.playTone`, `music.rest`, `basic.showIcon` + `IconNames`, `bluetooth.uartWriteString` /
  `uartReadUntil`, `serial.delimiters` + `Delimiters`, `Math.idiv`), with signatures copied from source.

It checks types only. It does not build a .hex, so MakeCode is still the final word.
