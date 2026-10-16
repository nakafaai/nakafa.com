import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, String as Str } from "effect";
import {
  endBand,
  nextBand,
  readingBand,
  readPixels,
  spyCandidate,
} from "@/components/player/spy";

/** The top and bottom insets of a root margin, in pixels. */
function readInsets(margin: string) {
  const [top = 0, , bottom = 0] = Arr.map(
    Str.split(margin, " "),
    Number.parseFloat
  );
  return { bottom, top };
}

describe("player scroll spy", () => {
  it("reads a computed length in pixels", () => {
    expect(readPixels("80px")).toEqual(Option.some(80));
    expect(readPixels("97.5px")).toEqual(Option.some(97.5));
  });

  it("reads no pixels from anything else", () => {
    expect(Option.isNone(readPixels("5rem"))).toBe(true);
    expect(Option.isNone(readPixels("auto"))).toBe(true);
    expect(Option.isNone(readPixels("px"))).toBe(true);
    expect(Option.isNone(readPixels("Infinitypx"))).toBe(true);
    expect(Option.isNone(readPixels(""))).toBe(true);
  });

  it("shrinks the viewport to a one pixel band below the clearance", () => {
    const { bottom, top } = readInsets(readingBand(900, 80));

    expect(-top).toBeGreaterThan(80);
    expect(900 + top + bottom).toBe(1);
  });

  it("moves the reading line with the clearance of the questions", () => {
    const small = readInsets(readingBand(900, 80));
    const large = readInsets(readingBand(900, 100));

    expect(small.top - large.top).toBe(20);
  });

  it("never asks for a negative margin on a viewport shorter than the line", () => {
    expect(readInsets(readingBand(40, 80)).bottom).toBeCloseTo(0);
  });

  it("keeps the end of the list out of view until it clears the footer", () => {
    expect(endBand(65)).toBe("0px 0px -65px 0px");
    expect(endBand(97.5)).toBe("0px 0px -97.5px 0px");
  });

  it("takes the last question that entered the line", () => {
    expect(nextBand(null, ["b", "c"])).toBe("c");
    expect(nextBand("a", ["b"])).toBe("b");
  });

  it("keeps the previous question while the line sits in a gap", () => {
    expect(nextBand("b", [])).toBe("b");
    expect(nextBand(null, [])).toBeNull();
  });

  it("marks the last question once the reader has scrolled to the end of the list", () => {
    expect(spyCandidate({ band: "b", end: true, scrolled: true }, "c")).toBe(
      "c"
    );
    expect(spyCandidate({ band: "b", end: false, scrolled: true }, "c")).toBe(
      "b"
    );
    expect(
      spyCandidate({ band: null, end: false, scrolled: true }, "c")
    ).toBeNull();
  });

  it("keeps the question under the line when the whole list fits in the window", () => {
    expect(spyCandidate({ band: "a", end: true, scrolled: false }, "c")).toBe(
      "a"
    );
  });
});
