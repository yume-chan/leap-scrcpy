import { Adb, AdbServerClient } from "@yume-chan/adb";
import { AdbScrcpyClient, AdbScrcpyOptions2_1 } from "@yume-chan/adb-scrcpy";
import { AdbServerNodeTcpConnector } from "@yume-chan/adb-server-node-tcp";
import { BIN } from "@yume-chan/fetch-scrcpy-server";
import {
  AndroidMotionEventAction,
  DefaultServerPath,
  h264ParseConfiguration,
  ScrcpyOptions3_1,
  ScrcpyPointerId,
  ScrcpyVideoCodecId,
} from "@yume-chan/scrcpy";
import { ReadableStream, WritableStream } from "@yume-chan/stream-extra";
import { createReadStream } from "node:fs";
import { InputLeapClient } from "./input-leap.js";
import { HidStylus } from "./hid.js";

const address = process.argv[2] ?? "localhost:24800";
const name = process.argv[3] ?? "Scrcpy";

const [host, port] = address.split(":");
if (!host || !port) {
  console.log("Usage: leap-scrcpy <server-address>");
  process.exit(1);
}

const adbClient = new AdbServerClient(
  new AdbServerNodeTcpConnector({ host: "127.0.0.1", port: 5037 })
);

const devices = await adbClient.getDevices();
if (devices.length === 0) {
  console.log("No device found");
  process.exit(1);
}

const adb = new Adb(await adbClient.createTransport(devices[0]));

await AdbScrcpyClient.pushServer(
  adb,
  ReadableStream.from(createReadStream(BIN)),
  DefaultServerPath
);

const scrcpyClient = await AdbScrcpyClient.start(
  adb,
  DefaultServerPath,
  new AdbScrcpyOptions2_1(
    new ScrcpyOptions3_1({ audio: false, showTouches: true })
  )
);

const videoStream = await scrcpyClient.videoStream;
if (!videoStream) {
  throw new Error("Video stream not found");
}

let stylus: HidStylus | undefined;
let inputLeapClient: InputLeapClient | undefined;

let screenWidth = 0;
let screenHeight = 0;

videoStream.stream.pipeTo(
  new WritableStream({
    async write(chunk) {
      if (chunk.type === "configuration") {
        switch (videoStream.metadata.codec) {
          case ScrcpyVideoCodecId.H264: {
            ({ croppedWidth: screenWidth, croppedHeight: screenHeight } =
              h264ParseConfiguration(chunk.data));

            console.log("Get screen size", screenWidth, screenHeight);

            if (!inputLeapClient) {
              stylus = new HidStylus(screenWidth, screenHeight);
              scrcpyClient.controller?.uHidCreate({
                id: 0,
                data: HidStylus.Descriptor,
                vendorId: 0,
                productId: 0,
                name: "Stylus",
              });

              inputLeapClient = await InputLeapClient.connect(
                host,
                Number.parseInt(port, 10),
                name,
                screenWidth,
                screenHeight
              );

              inputLeapClient.onEnter(({ x, y }) => {
                stylus!.enter();
                stylus!.move(x, y);
                scrcpyClient.controller!.uHidInput({
                  id: 0,
                  data: stylus!.report,
                });
              });

              inputLeapClient.onLeave(() => {
                stylus!.leave();
                scrcpyClient.controller!.uHidInput({
                  id: 0,
                  data: stylus!.report,
                });
              });

              inputLeapClient.onMouseMove(({ x, y }) => {
                stylus!.move(x, y);
                scrcpyClient.controller!.uHidInput({
                  id: 0,
                  data: stylus!.report,
                });
              });

              inputLeapClient.onMouseDown((button) => {
                stylus!.buttonDown(button);
                scrcpyClient.controller!.uHidInput({
                  id: 0,
                  data: stylus!.report,
                });
              });

              inputLeapClient.onMouseUp((button) => {
                stylus!.buttonUp(button);
                scrcpyClient.controller!.uHidInput({
                  id: 0,
                  data: stylus!.report,
                });
              });
            } else {
              inputLeapClient.setSize(screenWidth, screenHeight);
            }
            break;
          }
        }
      }
    },
  })
);
