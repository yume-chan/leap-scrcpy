import { Adb, AdbServerClient } from "@yume-chan/adb";
import { AdbServerNodeTcpConnector } from "@yume-chan/adb-server-node-tcp";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { InputLeapClient } from "./input-leap/client.js";
import { Lazy } from "./lazy.js";
import { RotationMapper } from "./rotation.js";
import { ServerClient } from "./server.js";
import { HidStylus } from "./stylus.js";

const address = process.argv[2] ?? "localhost:24800";
const name = process.argv[3] ?? "Android";

const [host, port] = address.split(":");
if (!host || !port) {
  console.log("Usage: leap-scrcpy <server-address>");
  process.exit(1);
}

const adbClient = new AdbServerClient(
  new AdbServerNodeTcpConnector({ host: "127.0.0.1", port: 5037 }),
);

const devices = await adbClient.getDevices();
if (devices.length === 0) {
  console.log("No device found");
  process.exit(2);
}

export const adb = new Adb(await adbClient.createTransport(devices[0]));
console.log("using device", adb.serial);

export const LocalRoot = resolve(fileURLToPath(import.meta.url), "../..");

const server = await ServerClient.start(
  adb,
  resolve(LocalRoot, "server/app/build/outputs/apk/debug/app-debug.apk"),
);

const rotationMapper = new RotationMapper();
const stylus = new HidStylus();
const uHidStylus = await server.createUHidDevice(0, HidStylus.Descriptor);

const inputLeapLazy = new Lazy(async (width: number, height: number) => {
  const client = await InputLeapClient.connect(
    {
      host,
      port: Number.parseInt(port, 10),
    },
    name,
    width,
    height,
  );

  console.log("[deskflow]", "server connected");

  client.onEnter(({ x, y }) => {
    rotationMapper.setLogicalPosition(x, y);

    stylus!.enter();
    stylus!.move(rotationMapper.x, rotationMapper.y);

    uHidStylus.write(stylus!.report);
  });

  client.onLeave(() => {
    stylus!.leave();
    uHidStylus.write(stylus!.report);
  });

  client.onMouseMove(({ x, y }) => {
    rotationMapper.setLogicalPosition(x, y);

    stylus!.move(rotationMapper.x, rotationMapper.y);

    uHidStylus.write(stylus!.report);
  });

  client.onMouseDown((button) => {
    stylus!.buttonDown(button);
    uHidStylus.write(stylus!.report);
  });

  client.onMouseUp((button) => {
    stylus!.buttonUp(button);
    uHidStylus.write(stylus!.report);
  });

  client.onClipboard((content) => {
    server.setClipboard(content);
  });

  return client;
});

server.onDisplayChange(async ({ width, height, rotation }) => {
  rotationMapper.setSize(width, height);
  rotationMapper.setRotation(rotation);

  if (!inputLeapLazy.hasValue) {
    inputLeapLazy.getOrCreate(
      rotationMapper.logicalWidth,
      rotationMapper.logicalHeight,
    );
  } else {
    const inputLeapClient = await inputLeapLazy.get();
    inputLeapClient.setSize(
      rotationMapper.logicalWidth,
      rotationMapper.logicalHeight,
      rotationMapper.logicalX,
      rotationMapper.logicalY,
    );
  }

  stylus.setSize(width, height);
  stylus.move(rotationMapper.x, rotationMapper.y);

  await uHidStylus.write(stylus.report);
});

server.onClipboardChange(async (content) => {
  const inputLeapClient = await inputLeapLazy.get();
  inputLeapClient.setClipboard(content);
});
