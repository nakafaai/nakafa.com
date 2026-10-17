import { Array as Arr, Predicate, Record, Schema } from "effect";

const encoder = new TextEncoder();
const isRecord = Schema.is(Schema.Record(Schema.String, Schema.Unknown));

/**
 * The bytes that a number, a boolean or a big integer takes in a stored document.
 * It is a fixed cost, because such a value holds no text.
 */
const FIXED_BYTES = 8;

/**
 * The bytes a stored value takes, counted the way the seal counts its I/O (ADR
 * 0024): text by its UTF-8 length, binary by its byte length, a key by its UTF-8
 * length, and a number or a boolean at a fixed cost. A missing value, such as a
 * document the read did not find, takes nothing. The sizes of nested values add up,
 * so a document's size is the sum of its parts.
 */
export function storedBytes(value: unknown): number {
  if (Predicate.isNull(value) || Predicate.isUndefined(value)) {
    return 0;
  }
  if (Predicate.isString(value)) {
    return encoder.encode(value).byteLength;
  }
  if (value instanceof ArrayBuffer) {
    return value.byteLength;
  }
  if (Arr.isArray(value)) {
    return Arr.reduce(value, 0, (total, item) => total + storedBytes(item));
  }
  if (isRecord(value)) {
    return Arr.reduce(
      Record.toEntries(value),
      0,
      (total, [key, item]) =>
        total + encoder.encode(key).byteLength + storedBytes(item)
    );
  }
  return FIXED_BYTES;
}
