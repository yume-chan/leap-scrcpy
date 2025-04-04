import { Adb, AdbNoneProtocolProcess } from "@yume-chan/adb";
import { EventEmitter } from "@yume-chan/event";
import type { WritableStreamDefaultWriter } from "@yume-chan/stream-extra";
import {
  MaybeConsumable,
  ReadableStream,
  StructDeserializeStream,
  WritableStream,
} from "@yume-chan/stream-extra";
import { buffer, s32, string, struct, StructInit } from "@yume-chan/struct";
import { createReadStream } from "fs";
import { UHidBus, UHidCreate2, UHidEventType, UHidInput2 } from "./uhid.js";
import { union } from "./union.js";

export const VersionMessage = struct(
  { major: s32, minor: s32 },
  { littleEndian: false },
);

export const DisplayInfoMessage = struct(
  { width: s32, height: s32, rotation: s32 },
  { littleEndian: false },
);

export const ClipboardMessage = struct(
  { content: string(s32) },
  { littleEndian: false },
);

export const UHidMessage = struct(
  { id: s32, data: buffer(s32) },
  { littleEndian: false },
);

export const MessageId = {
  Version: 0,
  DisplayInfo: 1,
  ClipboardChange: 2,
  UHidOutput: 3,
} as const;

export const Messages = struct(
  {
    value: union({ type: s32 }, {
      [MessageId.Version]: VersionMessage,
      [MessageId.DisplayInfo]: DisplayInfoMessage,
      [MessageId.ClipboardChange]: ClipboardMessage,
      [MessageId.UHidOutput]: UHidMessage,
    } as const),
  },
  { littleEndian: false },
);

export const ClipboardRequest = struct(
  { content: string(s32) },
  { littleEndian: false },
);

export const UHidRequestOperation = {
  Create: 0,
  Write: 1,
} as const;

export type UHidRequestOperation =
  (typeof UHidRequestOperation)[keyof typeof UHidRequestOperation];

export const UHidRequest = struct(
  { operation: s32<UHidRequestOperation>(), id: s32, data: buffer(s32) },
  { littleEndian: false },
);

export const RequestId = {
  SetClipboard: 0,
  UHidRequest: 1,
} as const;

export const Requests = struct(
  {
    value: union(
      { type: s32 },
      {
        [RequestId.SetClipboard]: ClipboardRequest,
        [RequestId.UHidRequest]: UHidRequest,
      },
    ),
  },
  { littleEndian: false },
);

const ServerPath = "/data/local/tmp/leap-scrcpy.jar";

export class ServerClient {
  static async start(adb: Adb, serverPath: string) {
    const sync = await adb.sync();
    try {
      console.log("[server]", "server path", serverPath);
      await sync.write({
        filename: ServerPath,
        file: ReadableStream.from(createReadStream(serverPath)),
      });
    } finally {
      await sync.dispose();
    }

    const process = await adb.subprocess.noneProtocol.spawn([
      "app_process",
      "-cp",
      ServerPath,
      "/",
      "leap.scrcpy.server.Main",
    ]);

    return new ServerClient(process);
  }

  #process: AdbNoneProtocolProcess;
  #writer: WritableStreamDefaultWriter<MaybeConsumable<Uint8Array>>;

  #ready = false;

  #onDisplayChange = new EventEmitter<{
    width: number;
    height: number;
    rotation: number;
  }>();
  get onDisplayChange() {
    return this.#onDisplayChange.event;
  }

  #onClipboardChange = new EventEmitter<string>();
  get onClipboardChange() {
    return this.#onClipboardChange.event;
  }

  constructor(process: AdbNoneProtocolProcess) {
    this.#process = process;
    this.#writer = process.stdin.getWriter();

    void this.#process.output
      .pipeThrough(new StructDeserializeStream(Messages))
      .pipeTo(
        new WritableStream({
          write: ({ value: message }) => {
            switch (message.type) {
              case MessageId.Version:
                if (this.#ready) {
                  throw new Error("Invalid protocol data");
                }

                if (message.major > 1) {
                  throw new Error("Incompatible version");
                }

                this.#ready = true;
                break;
              case MessageId.DisplayInfo:
                if (!this.#ready) {
                  throw new Error("Invalid protocol data");
                }

                this.#onDisplayChange.fire(message);
                break;
              case MessageId.ClipboardChange:
                if (!this.#ready) {
                  throw new Error("Invalid protocol data");
                }

                this.#onClipboardChange.fire(message.content);
                break;
              case MessageId.UHidOutput:
                if (!this.#ready) {
                  throw new Error("Invalid protocol data");
                }

                // TODO: handle UHID output if needed
                break;
            }
          },
        }),
      );
  }

  #write(request: StructInit<typeof Requests>["value"]) {
    const buffer = Requests.serialize({ value: request });
    // console.log("[server]", "write", buffer);
    return this.#writer.write(buffer);
  }

  setClipboard(content: string) {
    return this.#write({ type: 0, content });
  }

  async createUHidDevice(id: number, descriptor: Uint8Array) {
    await this.#write({
      type: RequestId.UHidRequest,
      operation: UHidRequestOperation.Create,
      id,
      data: UHidCreate2.serialize({
        type: UHidEventType.Create2,
        name: "input-scrcpy",
        phys: "",
        uniq: new Uint8Array(0),
        bus: UHidBus.Virtual,
        product: 0x0000,
        vendor: 0x0000,
        version: 0x0000,
        country: 0,
        rd_data: descriptor,
      }),
    });

    return new ServerUHidDevice(id, this.#writer);
  }

  stop() {
    return this.#process.kill();
  }
}

export class ServerUHidDevice {
  #id: number;
  #writer: WritableStreamDefaultWriter<MaybeConsumable<Uint8Array>>;

  constructor(
    id: number,
    writer: WritableStreamDefaultWriter<MaybeConsumable<Uint8Array>>,
  ) {
    this.#id = id;
    this.#writer = writer;
  }

  #write(request: StructInit<typeof Requests>["value"]) {
    const buffer = Requests.serialize({ value: request });
    // console.log("[server]", "write", buffer);
    return this.#writer.write(buffer);
  }

  write(report: Uint8Array) {
    return this.#write({
      type: RequestId.UHidRequest,
      operation: UHidRequestOperation.Write,
      id: this.#id,
      data: UHidInput2.serialize({
        type: UHidEventType.Input2,
        data: report,
      }),
    });
  }
}
