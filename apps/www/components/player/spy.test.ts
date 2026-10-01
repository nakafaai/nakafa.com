import { describe, expect, it } from "@effect/vitest";
import {
  nextSpyBand,
  readingBand,
  spyCandidate,
} from "@/components/player/spy";

describe("player scroll spy", () => {
  it("shrinks the viewport to a one pixel reading band", () => {
    expect(readingBand(900)).toBe("-88px 0px -811px 0px");
    expect(readingBand(40)).toBe("-88px 0px -0px 0px");
  });

  it("keeps the last question entering the band and holds it in gaps", () => {
    const start = { band: null, end: false };
    const moved = nextSpyBand(start, [
      { intersecting: false, key: "a" },
      { intersecting: true, key: "b" },
    ]);
    expect(moved).toEqual({ band: "b", end: false });
    expect(nextSpyBand(moved, [{ intersecting: false, key: "b" }])).toBe(moved);
  });

  it("prefers the last question once the end of the list is visible", () => {
    expect(spyCandidate({ band: "b", end: true }, "c")).toBe("c");
    expect(spyCandidate({ band: "b", end: false }, "c")).toBe("b");
  });
});
