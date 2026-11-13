// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BLOCKING,
  blockedChance,
  boundSpikes,
  isBlocked,
  levelOnDay,
  occupancyOf,
  SPIKES,
  spikeAnchor,
} from "@repo/design-system/components/contents/biology/virus/binding";
import { Array as Arr } from "effect";

describe("antibodies on spikes", () => {
  it("bind half the spikes at the dissociation constant", () => {
    expect(occupancyOf(0)).toBe(0);
    expect(occupancyOf(1)).toBeCloseTo(0.5);
    expect(occupancyOf(-3)).toBe(0);
    expect(occupancyOf(19)).toBeCloseTo(0.95);
  });

  it("covers the same spikes of a virion every time", () => {
    expect(boundSpikes(3, 0.5)).toEqual(boundSpikes(3, 0.5));
    expect(boundSpikes(3, 0)).toEqual(Arr.makeBy(SPIKES, () => false));
    expect(isBlocked(boundSpikes(3, 1))).toBe(true);
    expect(isBlocked(boundSpikes(3, 0))).toBe(false);
  });

  it("blocks almost no virion at low levels and almost every one at high", () => {
    expect(blockedChance(0)).toBe(0);
    expect(blockedChance(1)).toBeCloseTo(1);
    expect(blockedChance(occupancyOf(0.5))).toBeLessThan(0.01);
    expect(blockedChance(occupancyOf(20))).toBeGreaterThan(0.99);
    expect(BLOCKING).toBeLessThan(SPIKES);
  });

  it("raises the antibody level over the second week after a dose", () => {
    expect(levelOnDay(0)).toBeLessThan(0.1);
    expect(levelOnDay(11)).toBeCloseTo(10);
    expect(levelOnDay(28)).toBeGreaterThan(19.9);
  });
});

describe("spike anchors", () => {
  it("puts every spike on the unit sphere, from pole to pole", () => {
    Arr.forEach(Arr.range(0, SPIKES - 1), (index) => {
      const [x, y, z] = spikeAnchor(index, SPIKES);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1);
    });
    expect(spikeAnchor(0, SPIKES)[1]).toBeGreaterThan(0.9);
    expect(spikeAnchor(SPIKES - 1, SPIKES)[1]).toBeLessThan(-0.9);
  });
});
