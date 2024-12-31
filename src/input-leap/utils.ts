import { sequenceEqual } from "@yume-chan/adb";
import type { ExactReadable } from "@yume-chan/struct";

export function bufferExactReadable(
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

export function startsWith(buffer: Uint8Array, prefix: Uint8Array) {
  return sequenceEqual(buffer.subarray(0, prefix.length), prefix);
}
