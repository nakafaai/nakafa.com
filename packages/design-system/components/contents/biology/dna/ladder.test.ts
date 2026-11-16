// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ladderOf } from "@repo/design-system/components/contents/biology/dna/ladder";
import { HELIX } from "@repo/design-system/components/contents/biology/dna/strand";
import { Array as Arr } from "effect";

describe("the drawn ladder", () => {
  it("twists every pair as B-DNA before copying starts", () => {
    const ladder = ladderOf(21, 0);
    expect(ladder).toHaveLength(21);
    Arr.forEach(ladder, (rung) => {
      expect(rung.open).toBe(false);
      expect(Math.hypot(rung.first[1], rung.first[2])).toBeCloseTo(
        HELIX.diameter / 2
      );
      expect(rung.first[0]).toBeCloseTo(rung.index * HELIX.rise);
    });
  });

  it("opens from the far end and lays new partners behind the fork", () => {
    const ladder = ladderOf(20, 0.5);
    const closed = ladder[5];
    const fork = ladder[10];
    const far = ladder[19];
    expect(closed?.open).toBe(false);
    expect(fork?.open).toBe(true);
    expect(fork?.copied).toBe(false);
    expect(far?.copied).toBe(true);
    expect((far?.first[1] ?? 0) - (far?.newFirst[1] ?? 0)).toBeCloseTo(1.1);
    expect(far?.first[1]).toBeGreaterThan(fork?.first[1] ?? 0);
    expect(far?.second[1]).toBeCloseTo(-(far?.first[1] ?? 0));
  });

  it("draws nothing for an empty stretch", () => {
    expect(ladderOf(0, 0.5)).toHaveLength(0);
  });
});
