import { describe, expect, it } from "@effect/vitest";
import {
  nextBand,
  PLAYER_READING_LINE,
  readingBand,
  spyCandidate,
} from "@/components/player/spy";

describe("player scroll spy", () => {
  it("shrinks the viewport to a one pixel band at the reading line", () => {
    expect(readingBand(900)).toBe(
      `-${PLAYER_READING_LINE}px 0px -${900 - PLAYER_READING_LINE - 1}px 0px`
    );
  });

  it("never asks for a negative margin on a viewport shorter than the line", () => {
    expect(readingBand(40)).toBe(`-${PLAYER_READING_LINE}px 0px -0px 0px`);
  });

  it("takes the last question that entered the line", () => {
    expect(nextBand(null, ["b", "c"])).toBe("c");
    expect(nextBand("a", ["b"])).toBe("b");
  });

  it("keeps the previous question while the line sits in a gap", () => {
    expect(nextBand("b", [])).toBe("b");
    expect(nextBand(null, [])).toBeNull();
  });

  it("marks the last question once the end of the list is in view", () => {
    expect(spyCandidate({ band: "b", end: true }, "c")).toBe("c");
    expect(spyCandidate({ band: "b", end: false }, "c")).toBe("b");
    expect(spyCandidate({ band: null, end: false }, "c")).toBeNull();
  });
});
