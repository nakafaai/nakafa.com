import { describe, expect, it } from "@effect/vitest";
import { audioTypeOf, videoIdOf } from "@repo/backend/confect/exams/media";
import { Array as Arr, Option } from "effect";

/** The bytes of an ASCII text. */
const ascii = (text: string) =>
  Arr.map(Arr.fromIterable(text), (letter) => letter.charCodeAt(0));

/** A file's leading bytes. */
const head = (...bytes: readonly number[]) => Uint8Array.from(bytes);

describe("exams/media audioTypeOf", () => {
  it("names a clip by its leading bytes", () => {
    expect(audioTypeOf(head(...ascii("ID3"), 4))).toEqual(
      Option.some("audio/mpeg")
    );
    expect(audioTypeOf(head(0xff, 0xfb, 0x90))).toEqual(
      Option.some("audio/mpeg")
    );
    expect(audioTypeOf(head(0, 0, 0, 32, ...ascii("ftypM4A ")))).toEqual(
      Option.some("audio/mp4")
    );
    expect(audioTypeOf(head(...ascii("OggS")))).toEqual(
      Option.some("audio/ogg")
    );
    expect(
      audioTypeOf(head(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")))
    ).toEqual(Option.some("audio/wav"));
  });

  it("refuses a file that is no clip, an image in RIFF included", () => {
    expect(Option.isNone(audioTypeOf(head(0x89, 0x50, 0x4e, 0x47)))).toBe(true);
    expect(
      Option.isNone(
        audioTypeOf(head(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))
      )
    ).toBe(true);
    expect(Option.isNone(audioTypeOf(head()))).toBe(true);
  });
});

describe("exams/media videoIdOf", () => {
  it("reads the video of every link YouTube shares", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
    ]) {
      expect(videoIdOf(link)).toEqual(Option.some("dQw4w9WgXcQ"));
    }
  });

  it("refuses any other link and text that is no link", () => {
    expect(Option.isNone(videoIdOf("https://vimeo.com/76979871"))).toBe(true);
    expect(Option.isNone(videoIdOf("https://youtu.be/short"))).toBe(true);
    expect(Option.isNone(videoIdOf("video pelajaran"))).toBe(true);
  });
});
