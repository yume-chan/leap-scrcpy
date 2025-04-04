# leap-scrcpy

A [Deskflow](https://github.com/deskflow/deskflow) client for Android.

The name is _leap-scrcpy_ because originally it uses [Input Leap](https://github.com/input-leap/input-leap) and [Scrcpy](https://github.com/Genymobile/scrcpy).

## Features

It's still in early development stage:

- [x] Mouse movement
- [x] Mouse click
- [ ] Mouse scroll wheel
- [x] Two-way clipboard sync
- [ ] Keyboard
- [ ] File Drag and Drop

## Prerequisites

### ADB

Download and run `adb`: https://developer.android.com/tools/releases/platform-tools#downloads

Enable USB debugging or Wireless debugging on your Android device.

### Deskflow

1. Download and install [Deskflow](https://github.com/deskflow/deskflow)
2. Set your PC as server
3. In **Edit** -> **Preferences**, turn off **Require client certificates**
4. Add a screen named "Android" and place it as you want (https://github.com/input-leap/input-leap#usage)

[Barrier](https://github.com/debauchee/barrier), [Input Leap](https://github.com/input-leap/input-leap) and [Synergy 1](https://symless.com/synergy) should also be compatible, but Synergy 3 is not.

### Android Studio

[Android Studio](https://developer.android.com/studio) is required to build the server, before a binary release is ready.

## Build

There is no binary release yet, so you need to run from source

### Build server

```sh
cd server
./gradlew assembleDebug
```

Don't use release build because the path is hardcoded.

### Build client

1. Install Node.js and pnpm (`npm i -g pnpm`)
2. Clone this repository
3. Run `pnpm install`
4. Run `pnpm build`

## Usage

```sh
node esm/index.js [server-address] [name]
```

Server address is like `host:port`. Defaults to `localhost:24800` which is the default port of Input Leap running on current machine.

Name must be same as the screen name you added in Input Leap. Defaults to `Android`.

Now when you move the mouse to the configured edge, it will teleport to the Android device.
