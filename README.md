# leap-scrcpy

Combine the power of [Input Leap](https://github.com/input-leap/input-leap) and [Scrcpy](https://github.com/Genymobile/scrcpy), use your Android devices like secondary screens.

It doesn't mirror your device's screen on PC. It allows you to move your mouse between PC and Android devices seamlessly.

## Features

It's still in early development stage:

* [x] Mouse movement
* [x] Mouse click
* [ ] Mouse scroll wheel
* [x] Two-way clipboard sync
* [ ] Keyboard
* [ ] File Drag and Drop

Known issues:

* Mouse coordinates are incorrect after device rotation

## Prerequisites

### ADB

Download and run `adb`: https://developer.android.com/tools/releases/platform-tools#downloads

### Input Leap

1. Download and install [Input Leap](https://github.com/input-leap/input-leap)
2. Set your PC as server
3. Add a screen named "Scrcpy" and place it as you want (https://github.com/input-leap/input-leap#usage)

### Scrcpy

Prepare your Android device to run Scrcpy (https://github.com/Genymobile/scrcpy#prerequisites).

This project is an alternative Scrcpy client. You don't need to download nor run Scrcpy.

Connect only 1 android devices, because it doesn't support selecting devices yet.

## Build

There is no binary release yet, so you need to run from source

1. Install Node.js and pnpm (`npm i -g pnpm`)
2. Clone this repository
3. Run `pnpm install`
4. Run `npx tsc`

## Usage

```sh
node esm/index.js [server-address] [name]
```

Server address is like `host:port`. Defaults to `localhost:24800` which is the default port of Input Leap running on current machine.

Name must be same as the screen name you added in Input Leap. Defaults to `Scrcpy`.

Now when you move the mouse to the configured edge, it will teleport to the Android device.
