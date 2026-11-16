import { describe, expect, it } from "@effect/vitest";
import {
  deckAt,
  deckEdge,
  type HullLines,
  halfAt,
  hullGeometry,
  stationAt,
} from "@repo/design-system/components/three/vessel/hull";

const LINES: HullLines = {
  beam: 1,
  bow: 0.4,
  depth: 0.5,
  forefoot: 0.4,
  length: 2.6,
  rake: 0.5,
  run: 0.12,
  sheer: 0.4,
  square: 5,
  transom: 0.8,
};

describe("stationAt", () => {
  it("narrows to the transom aft, keeps the beam amidships and closes at the stem", () => {
    expect(stationAt(LINES, 0).half).toBeCloseTo(0.4, 6);
    expect(stationAt(LINES, 0.4).half).toBeCloseTo(0.5, 6);
    expect(stationAt(LINES, 1).half).toBeCloseTo(0, 6);
  });

  it("raises the deck and the forefoot toward the bow", () => {
    expect(stationAt(LINES, 1).deck).toBeCloseTo(0.7, 6);
    expect(stationAt(LINES, 0.3).deck).toBe(0.5);
    expect(stationAt(LINES, 1).keel).toBeCloseTo(0.2, 6);
  });
});

describe("hullGeometry", () => {
  it("closes the deck as its own group when the band reaches it", () => {
    const geometry = hullGeometry(LINES, 0.2, Number.POSITIVE_INFINITY);
    const [shell, deck] = geometry.groups;

    expect(shell?.count).toBeGreaterThan(0);
    expect(deck?.count).toBeGreaterThan(0);
    expect(geometry.boundingSphere?.radius).toBeGreaterThan(1.3);
  });

  it("leaves the deck open in a band below it", () => {
    const geometry = hullGeometry(LINES, 0, 0.2);

    expect(geometry.groups[1]?.count).toBe(0);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.max.y).toBeLessThanOrEqual(0.2 + 1e-6);
  });
});

describe("deckEdge", () => {
  it("runs from the port quarter round the stem to the starboard quarter", () => {
    const edge = deckEdge(LINES, 0.1, 0);

    expect(edge).toHaveLength(97);
    expect(edge[0]?.[2]).toBeCloseTo(-0.4, 6);
    expect(edge[96]?.[2]).toBeCloseTo(0.4, 6);
    expect(edge[0]?.[1]).toBeCloseTo(0.6, 6);
  });
});

describe("deckAt and halfAt", () => {
  it("read the deck's height and half-breadth along the hull", () => {
    expect(deckAt(LINES, 0)).toBe(0.5);
    expect(halfAt(LINES, 0)).toBeCloseTo(0.5, 6);
    expect(halfAt(LINES, -1.3)).toBeCloseTo(0.4, 6);
  });
});
