import { describe, expect, it } from "@effect/vitest";
import { imageTypeOf } from "@repo/backend/confect/exams/image";
import { Option } from "effect";

/** The bytes of an ASCII text, which a file's header holds. */
const bytesOf = (text: string) =>
  Uint8Array.from(Array.from(text, (character) => character.charCodeAt(0)));

describe("imageTypeOf", () => {
  it("identifies PNG, JPEG, GIF in both of its versions, and WebP by their headers", () => {
    expect(
      imageTypeOf(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    ).toEqual(Option.some("image/png"));
    expect(imageTypeOf(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0))).toEqual(
      Option.some("image/jpeg")
    );
    expect(imageTypeOf(bytesOf("GIF87a"))).toEqual(Option.some("image/gif"));
    expect(imageTypeOf(bytesOf("GIF89a"))).toEqual(Option.some("image/gif"));
    expect(
      imageTypeOf(bytesOf("RIFF\u0010\u0000\u0000\u0000WEBPVP8 "))
    ).toEqual(Option.some("image/webp"));
  });

  it("identifies no image in a RIFF file that is not WebP, nor in a file whose header is cut short", () => {
    expect(
      imageTypeOf(bytesOf("RIFF\u0010\u0000\u0000\u0000WAVEfmt "))
    ).toEqual(Option.none());
    expect(imageTypeOf(Uint8Array.of(0x89, 0x50))).toEqual(Option.none());
  });

  it("identifies no image in text, whatever its name or its declared type says", () => {
    expect(
      imageTypeOf(bytesOf('<svg xmlns="http://www.w3.org/2000/svg">'))
    ).toEqual(Option.none());
    expect(imageTypeOf(bytesOf("%PDF-1.7"))).toEqual(Option.none());
    expect(imageTypeOf(new Uint8Array())).toEqual(Option.none());
  });
});
