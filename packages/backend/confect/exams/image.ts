import type { ImageType } from "@repo/backend/confect/exams/asset";
import { Array as Arr, Option, Schema } from "effect";

/** The kind of image the editor accepts, which a file's leading bytes name. */
type ImageKind = typeof ImageType.Type;

/** A run of bytes that a file holds at one offset, which identifies a kind of image. */
const SignatureSchema = Schema.Struct({
  bytes: Schema.Array(Schema.Int),
  offset: Schema.Int,
});

/** A run of bytes that a file holds at one offset, which identifies a kind of image. */
type Signature = typeof SignatureSchema.Type;

/** The bytes of an ASCII text, one number per character. */
const ascii = (text: string) =>
  Arr.map(Arr.fromIterable(text), (character) => character.charCodeAt(0));

/**
 * The signatures of each image type, read from each format's own file header. A type with
 * two versions of its header has one signature for each version. The bytes are read from the
 * file itself, never from its name or its declared type.
 */
const SIGNATURES: readonly (readonly [ImageKind, readonly Signature[]])[] = [
  [
    "image/png",
    [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 }],
  ],
  ["image/jpeg", [{ bytes: [0xff, 0xd8, 0xff], offset: 0 }]],
  ["image/gif", [{ bytes: ascii("GIF87a"), offset: 0 }]],
  ["image/gif", [{ bytes: ascii("GIF89a"), offset: 0 }]],
  [
    "image/webp",
    [
      { bytes: ascii("RIFF"), offset: 0 },
      { bytes: ascii("WEBP"), offset: 8 },
    ],
  ],
];

/** Whether the bytes of a file hold `expected` from `offset`, and a file too short for them holds none. */
function startsAt(file: Uint8Array, { bytes, offset }: Signature) {
  return Arr.every(bytes, (value, index) => file[offset + index] === value);
}

/**
 * The kind of image that the leading bytes of a file identify, or none when they identify no
 * image the editor accepts. Only the first bytes of a file are read, so the check costs a few
 * bytes whatever the size of the file.
 */
export function imageTypeOf(head: Uint8Array): Option.Option<ImageKind> {
  return Option.map(
    Arr.findFirst(SIGNATURES, ([, signatures]) =>
      Arr.every(signatures, (signature) => startsAt(head, signature))
    ),
    ([type]) => type
  );
}
