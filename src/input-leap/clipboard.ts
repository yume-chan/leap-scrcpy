import {
  bipedal,
  buffer,
  decodeUtf8,
  EmptyUint8Array,
  encodeUtf8,
  struct,
  u32,
  u8,
  type DeserializeContext,
  type Field,
  type StructLike,
  type StructValue,
} from "@yume-chan/struct";
import { MessageType } from "./message-type.js";
import { bufferExactReadable } from "./utils.js";

export const MessageClipboard = struct(
  {
    type: buffer(MessageType.Clipboard.length),
    id: u8,
    sequence: u32,
    mark: u8,
    data: buffer(u32),
  },
  { littleEndian: false }
);

const Mark = {
  Start: 1,
  Chunk: 2,
  End: 3,
} as const;

function array<F extends Field<unknown, string, unknown>>(
  field: F
): Field<
  F extends Field<infer FT, string, unknown> ? FT[] : never,
  never,
  never
>;
function array<S extends StructLike<unknown>>(
  struct: S
): Field<StructValue<S>[], never, never>;
function array(
  type: Field<unknown, string, unknown> | StructLike<unknown>
): Field<unknown, never, never> {
  if ("fields" in type) {
    return {
      size: 4,
      dynamicSize(value: unknown[]) {
        return (
          4 +
          value.reduce<number>(
            (acc, item) => acc + type.serialize(item as never).length,
            0
          )
        );
      },
      serialize(value: unknown[], context) {
        context = { ...context };

        u32.serialize(value.length, context);
        context.index += 4;

        for (const item of value) {
          const size = type.serialize(
            item as never,
            context.buffer.subarray(context.index)
          );
          context.index += size;
        }
      },
      deserialize: bipedal(function* (
        then,
        context: DeserializeContext<never>
      ) {
        const length = yield* then(u32.deserialize(context));

        const result = new Array(length);
        for (let i = 0; i < length; i += 1) {
          result[i] = yield* then(type.deserialize(context.reader));
        }

        return result as never;
      }),
    };
  }

  return {
    size: 4,
    dynamicSize(value: unknown[]) {
      if (!type.dynamicSize) {
        return 4 + type.size * value.length;
      }
      return (
        4 +
        value.reduce<number>((acc, item) => acc + type.dynamicSize!(item), 0)
      );
    },
    serialize(value: unknown[], context) {
      context = { ...context };

      u32.serialize(value.length, context);
      context.index += 4;

      for (const item of value) {
        type.serialize(item, context);
        context.index += type.dynamicSize ? type.dynamicSize(item) : type.size;
      }
    },
    deserialize: bipedal(function* (then, context: DeserializeContext<never>) {
      const length = yield* then(u32.deserialize(context));

      const result = new Array(length);
      for (let i = 0; i < length; i += 1) {
        result[i] = yield* then(type.deserialize(context));
      }

      return result as never;
    }),
  };
}

const Clipboard = struct(
  {
    formats: array(
      struct({ format: u32, data: buffer(u32) }, { littleEndian: false })
    ),
  },
  { littleEndian: false }
);

const ClipboardFormat = {
  Text: 0,
  Html: 1,
  Bitmap: 2,
  Png: 3,
  Jpeg: 4,
  Tiff: 5,
  WebP: 6,
};

export class ClipboardChunk {
  static *serialize(sequence: number, data: string) {
    const buffer = Clipboard.serialize({
      formats: [{ format: ClipboardFormat.Text, data: encodeUtf8(data) }],
    });

    yield MessageClipboard.serialize({
      type: MessageType.Clipboard,
      id: 0,
      sequence,
      mark: Mark.Start,
      data: encodeUtf8(buffer.length.toString()),
    });

    for (let i = 0; i < buffer.length; i += 32 * 1024) {
      yield MessageClipboard.serialize({
        type: MessageType.Clipboard,
        id: 0,
        sequence,
        mark: Mark.Chunk,
        data: buffer.subarray(i, i + 32 * 1024),
      });
    }

    yield MessageClipboard.serialize({
      type: MessageType.Clipboard,
      id: 0,
      sequence,
      mark: Mark.End,
      data: EmptyUint8Array,
    });
  }

  #expectedSize: number = 0;
  #data: Uint8Array = EmptyUint8Array;
  #dataIndex = 0;

  write(buffer: Uint8Array) {
    const message = MessageClipboard.deserialize(
      bufferExactReadable(buffer, 0)
    );
    switch (message.mark) {
      case Mark.Start:
        this.#expectedSize = Number.parseInt(decodeUtf8(message.data));
        this.#data = new Uint8Array(this.#expectedSize);
        this.#dataIndex = 0;
        break;
      case Mark.Chunk:
        this.#data.set(message.data, this.#dataIndex);
        this.#dataIndex += message.data.length;
        break;
      case Mark.End:
        if (this.#dataIndex !== this.#expectedSize) {
          throw new Error("Invalid data size");
        }
        const clipboard = Clipboard.deserialize(
          bufferExactReadable(this.#data, 0)
        );
        for (const format of clipboard.formats) {
          if (format.format === ClipboardFormat.Text) {
            return decodeUtf8(format.data);
          }
        }
    }
  }
}
