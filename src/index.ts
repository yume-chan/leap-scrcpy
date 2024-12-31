import { Adb, AdbServerClient } from "@yume-chan/adb";
import { AdbScrcpyClient, AdbScrcpyOptions2_1 } from "@yume-chan/adb-scrcpy";
import { AdbServerNodeTcpConnector } from "@yume-chan/adb-server-node-tcp";
import ScrcpyServer from "@yume-chan/fetch-scrcpy-server/server.bin" with { type: "file" };
import {
  DefaultServerPath,
  h264ParseConfiguration,
  ScrcpyOptions3_1,
} from "@yume-chan/scrcpy";
import { WritableStream } from "@yume-chan/stream-extra";
import { file } from 'bun';
import { HidStylus } from "./hid.js";
import { InputLeapClient } from "./input-leap/client.js";

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
  file(ScrcpyServer).stream() as never,
  DefaultServerPath
);

const options = new AdbScrcpyOptions2_1(
  new ScrcpyOptions3_1({ audio: false, showTouches: true })
);

const scrcpyClient = await AdbScrcpyClient.start(
  adb,
  DefaultServerPath,
  options
);

const videoStream = await scrcpyClient.videoStream;
if (!videoStream) {
  throw new Error("Video stream not found");
}

let stylus: HidStylus | undefined;
let inputLeapClient: InputLeapClient | undefined;

for await (const chunk of videoStream.stream) {
  if (chunk.type === "configuration") {
    const { croppedWidth: width, croppedHeight: height } =
      h264ParseConfiguration(chunk.data);

    if (!inputLeapClient) {
      stylus = new HidStylus(width, height);
      scrcpyClient.controller!.uHidCreate({
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
        width,
        height
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

      inputLeapClient.onClipboard((data) => {
        scrcpyClient.controller!.setClipboard({
          content: data,
          paste: false,
          sequence: 0n,
        });
      });

      options.clipboard!.pipeTo(
        new WritableStream({
          write(chunk) {
            inputLeapClient!.setClipboard(chunk);
          },
        })
      );
    } else {
      stylus!.setSize(height, height);
      inputLeapClient.setSize(width, height);
    }
  }
}
