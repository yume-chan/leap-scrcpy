import { encodeUtf8, sequenceEqual } from "@yume-chan/adb";
import { EventEmitter } from "@yume-chan/event";
import {
  getUint32BigEndian,
  setUint32BigEndian,
} from "@yume-chan/no-data-view";
import {
  BufferedReadableStream,
  ReadableStream,
} from "@yume-chan/stream-extra";
import {
  buffer,
  decodeUtf8,
  ExactReadable,
  string,
  struct,
  u16,
  u32,
} from "@yume-chan/struct";
import { once } from "node:events";
import { connect, TLSSocket } from "node:tls";

function bufferExactReadable(
  buffer: Uint8Array,
  position: number
): ExactReadable {
  return {
    get position() {
      return position;
    },
    readExactly(length) {
      const result = buffer.subarray(this.position, this.position + length);
      position += result.length;
      return result;
    },
  };
}

function startsWith(buffer: Uint8Array, prefix: Uint8Array) {
  return sequenceEqual(buffer.subarray(0, prefix.length), prefix);
}

const MessageType = {
  Hello: encodeUtf8("Barrier"),
  KeepAlive: encodeUtf8("CALV"),
  QueryInfo: encodeUtf8("QINF"),
  Info: encodeUtf8("DINF"),
  AckInfo: encodeUtf8("CIAK"),
  MouseMove: encodeUtf8("DMMV"),
  MouseDown: encodeUtf8("DMDN"),
  MouseUp: encodeUtf8("DMUP"),
  Enter: encodeUtf8("CINN"),
  Leave: encodeUtf8("COUT"),
} as const;

const MessageHello = struct(
  {
    versionMajor: u16,
    versionMinor: u16,
  },
  {
    littleEndian: false,
  }
);

const MessageHelloBack = struct(
  {
    type: buffer(MessageType.Hello.length),
    versionMajor: u16,
    versionMinor: u16,
    name: string(u32),
  },
  {
    littleEndian: false,
  }
);

const MessageInfo = struct(
  {
    type: buffer(MessageType.Info.length),
    screenX: u16,
    screenY: u16,
    screenWidth: u16,
    screenHeight: u16,
    unused: u16,
    mouseX: u16,
    mouseY: u16,
  },
  { littleEndian: false }
);

const MessageMouseMove = struct(
  {
    x: u16,
    y: u16,
  },
  { littleEndian: false }
);

const MessageEnter = struct(
  {
    x: u16,
    y: u16,
    sequenceNumber: u32,
    mask: u16,
  },
  { littleEndian: false }
);

async function readMessage(readable: BufferedReadableStream) {
  const buffer = await readable.readExactly(4);
  const length = getUint32BigEndian(buffer, 0);

  if (length > 1024) {
    throw new Error("Message too long");
  }

  return await readable.readExactly(length);
}

function writeMessage(socket: TLSSocket, message: Uint8Array) {
  const size = new Uint8Array(4);
  setUint32BigEndian(size, 0, message.length);
  socket.write(size);
  socket.write(message);
}

export class InputLeapClient {
  static readonly VersionMajor = 1;
  static readonly VersionMinor = 6;

  static async connect(
    host: string,
    port: number,
    name: string,
    width: number,
    height: number
  ) {
    const socket = connect(port, host, {
      rejectUnauthorized: false,
    });
    await once(socket, "secureConnect");

    const serverCertificate = socket.getPeerCertificate();
    console.log("Server SHA256 Fingerprint:", serverCertificate.fingerprint256);
    console.log("Server SHA1 Fingerprint:", serverCertificate.fingerprint);

    const readable = ReadableStream.from<Uint8Array>(socket);
    const buffered = new BufferedReadableStream(readable);
    while (true) {
      const buffer = await readMessage(buffered);

      if (startsWith(buffer, MessageType.Hello)) {
        const message = MessageHello.deserialize(
          bufferExactReadable(buffer, MessageType.Hello.length)
        );

        if (
          message.versionMajor < InputLeapClient.VersionMajor ||
          (message.versionMajor === InputLeapClient.VersionMajor &&
            message.versionMinor < InputLeapClient.VersionMinor)
        ) {
          throw new Error("Incompatible version");
        }

        writeMessage(
          socket,
          MessageHelloBack.serialize({
            type: MessageType.Hello,
            versionMajor: InputLeapClient.VersionMajor,
            versionMinor: InputLeapClient.VersionMinor,
            name,
          })
        );

        continue;
      }

      if (startsWith(buffer, MessageType.QueryInfo)) {
        writeMessage(
          socket,
          MessageInfo.serialize({
            type: MessageType.Info,
            screenX: 0,
            screenY: 0,
            screenWidth: width,
            screenHeight: height,
            unused: 0,
            mouseX: 0,
            mouseY: 0,
          })
        );
        continue;
      }

      if (startsWith(buffer, MessageType.AckInfo)) {
        return new InputLeapClient(socket, buffered);
      }

      if (startsWith(buffer, MessageType.KeepAlive)) {
        writeMessage(socket, MessageType.KeepAlive);
        continue;
      }

      const type = decodeUtf8(buffer.subarray(0, 4));
      console.log("Received", "Unknown", type);
    }
  }

  #socket: TLSSocket;
  #keepAliveTimeout: NodeJS.Timeout;

  #onEnter = new EventEmitter<{
    x: number;
    y: number;
    sequenceNumber: number;
    mask: number;
  }>();
  get onEnter() {
    return this.#onEnter.event;
  }

  #onLeave = new EventEmitter<void>();
  get onLeave() {
    return this.#onLeave.event;
  }

  #onMouseMove = new EventEmitter<{ x: number; y: number }>();
  get onMouseMove() {
    return this.#onMouseMove.event;
  }

  #onMouseDown = new EventEmitter<number>();
  get onMouseDown() {
    return this.#onMouseDown.event;
  }

  #onMouseUp = new EventEmitter<number>();
  get onMouseUp() {
    return this.#onMouseUp.event;
  }

  constructor(socket: TLSSocket, readable: BufferedReadableStream) {
    this.#socket = socket;

    this.#keepAliveTimeout = setTimeout(() => {
      this.#writeMessage(MessageType.KeepAlive);
    }, 3000);
    this.#keepAliveTimeout.unref();

    (async () => {
      while (true) {
        const buffer = await readMessage(readable);

        if (startsWith(buffer, MessageType.Enter)) {
          const message = MessageEnter.deserialize(
            bufferExactReadable(buffer, MessageType.Enter.length)
          );
          this.#onEnter.fire({
            x: message.x,
            y: message.y,
            sequenceNumber: message.sequenceNumber,
            mask: message.mask,
          });
          continue;
        }

        if (startsWith(buffer, MessageType.Leave)) {
          this.#onLeave.fire();
          continue;
        }

        if (startsWith(buffer, MessageType.MouseMove)) {
          const message = MessageMouseMove.deserialize(
            bufferExactReadable(buffer, MessageType.MouseMove.length)
          );
          this.#onMouseMove.fire({ x: message.x, y: message.y });
          continue;
        }

        if (startsWith(buffer, MessageType.MouseDown)) {
          const button = buffer[MessageType.MouseDown.length + 1];
          this.#onMouseDown.fire(button)
          continue;
        }

        if (startsWith(buffer, MessageType.MouseUp)) {
          const button = buffer[MessageType.MouseUp.length + 1];
          this.#onMouseUp.fire(button)
          continue;
        }

        if (startsWith(buffer, MessageType.KeepAlive)) {
          continue;
        }

        const type = decodeUtf8(buffer.subarray(0, 4));
        console.log("Received", "Unknown", type);
      }
    })();
  }

  #writeMessage(message: Uint8Array) {
    writeMessage(this.#socket, message);
    this.#keepAliveTimeout.refresh();
  }

  setSize(width: number, height: number) {
    this.#writeMessage(
      MessageInfo.serialize({
        type: MessageType.Info,
        screenX: 0,
        screenY: 0,
        screenWidth: width,
        screenHeight: height,
        unused: 0,
        mouseX: 0,
        mouseY: 0,
      })
    );
  }
}
