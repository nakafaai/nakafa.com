// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type {
  Point,
  Vesicle,
} from "@repo/design-system/components/contents/biology/synapse/anatomy";
import {
  BILAYER,
  BOUTON,
  boutonFace,
  boutonProfile,
  boutonRadius,
  CHANNELS,
  CLEFT,
  DENDRITE,
  DENSITY,
  dendriteProfile,
  dendriteTop,
  ENZYMES,
  fitsVesicle,
  fromMitochondrion,
  MICROTUBULE,
  MICROTUBULES,
  MITOCHONDRION,
  nearest,
  PROJECTIONS,
  RECEPTOR,
  RELEASE,
  ROW,
  receptors,
  TRANSPORTERS,
  VESICLE,
  vesicles,
} from "@repo/design-system/components/contents/biology/synapse/anatomy";
import { Array as Arr } from "effect";

/** Distance across the cleft's plane from a point to the nearer release site. */
function toRelease([x, , z]: Point) {
  return Math.min(
    ...Arr.map(RELEASE, ([rx, , rz]) => Math.hypot(x - rx, z - rz))
  );
}

describe("measured sizes", () => {
  it("keeps the measured sizes at one unit to 10 nm", () => {
    expect(BILAYER * 10).toBe(5);
    expect(CLEFT * 10).toBe(30);
    expect(VESICLE.radius * 20).toBeCloseTo(41.6);
    expect(VESICLE.spread * 20).toBeCloseTo(8.4);
    expect(RECEPTOR.radius * 20).toBe(8);
    expect(RECEPTOR.length * 10).toBe(16);
    expect(MICROTUBULE * 20).toBe(25);
  });
});

describe("the bouton", () => {
  it("is widest at its middle and narrows into its axon", () => {
    expect(boutonRadius(CLEFT + BOUTON.half)).toBeCloseTo(BOUTON.radius);
    expect(boutonRadius(BOUTON.top)).toBeCloseTo(BOUTON.axon);
    expect(boutonRadius(BOUTON.top + 1)).toBe(0);
    expect(boutonRadius(CLEFT - 1)).toBe(0);
  });

  it("lays its flat face on the cleft and curves up at its rim", () => {
    expect(boutonFace(0)).toBeCloseTo(CLEFT);
    expect(boutonFace(BOUTON.radius * 2)).toBe(CLEFT + BOUTON.half);
    expect(boutonFace(10)).toBeLessThan(CLEFT + 0.3);
    expect(boutonFace(-10)).toBe(boutonFace(10));
  });

  it("draws its outline from the middle of its face up the axon", () => {
    const outline = boutonProfile(48);
    expect(outline).toHaveLength(97);
    expect(outline[0]?.[0]).toBeCloseTo(0);
    expect(outline[0]?.[1]).toBeCloseTo(CLEFT);
    expect(outline[48]?.[0]).toBeCloseTo(BOUTON.radius);
    expect(outline[48]?.[1]).toBeCloseTo(CLEFT + BOUTON.half);
    expect(outline[96]?.[0]).toBeCloseTo(BOUTON.axon);
    expect(outline[96]?.[1]).toBeCloseTo(BOUTON.top);
  });
});

describe("the dendrite", () => {
  it("lays its upper face on the cleft and rounds down at its sides", () => {
    expect(dendriteTop(0)).toBeCloseTo(0);
    expect(dendriteTop(DENDRITE.width)).toBeCloseTo(-DENDRITE.half);
    expect(dendriteTop(-DENDRITE.width * 2)).toBeCloseTo(-DENDRITE.half);
  });

  it("draws its cross-section from the top of the cut round its back", () => {
    const outline = dendriteProfile(4);
    expect(outline).toHaveLength(5);
    expect(outline[0]?.[0]).toBeCloseTo(0);
    expect(outline[0]?.[1]).toBeCloseTo(0);
    expect(outline[2]?.[0]).toBeCloseTo(-DENDRITE.width);
    expect(outline[2]?.[1]).toBeCloseTo(-DENDRITE.half);
    expect(outline[4]?.[1]).toBeCloseTo(-2 * DENDRITE.half);
  });

  it("holds its microtubules inside it", () => {
    Arr.forEach(MICROTUBULES, ([z, y]) => {
      expect(y + MICROTUBULE).toBeLessThan(dendriteTop(z));
      expect(y - MICROTUBULE).toBeGreaterThan(-2 * DENDRITE.half);
    });
  });
});

describe("the mitochondrion", () => {
  it("measures distance from its axis, capped at its ends", () => {
    const [x, y, z] = MITOCHONDRION.centre;
    expect(fromMitochondrion(MITOCHONDRION.centre)).toBe(0);
    expect(fromMitochondrion([x, y + MITOCHONDRION.radius, z])).toBeCloseTo(
      MITOCHONDRION.radius
    );
    expect(
      fromMitochondrion([x + MITOCHONDRION.half + 3, y, z + 4])
    ).toBeCloseTo(5);
  });
});

describe("vesicles", () => {
  const vesicle = (centre: Point): Vesicle => ({
    centre,
    docked: false,
    radius: 2,
  });

  it("fit only inside the bouton, clear of the mitochondrion and of each other", () => {
    expect(fitsVesicle(vesicle([0, 10, -5]), [])).toBe(true);
    expect(fitsVesicle(vesicle([40, 10, 0]), [])).toBe(false);
    expect(fitsVesicle(vesicle(MITOCHONDRION.centre), [])).toBe(false);
    expect(fitsVesicle(vesicle([0, 10, -5]), [vesicle([1, 10, -5])])).toBe(
      false
    );
  });

  it("dock four on the active zone, then stop once enough are placed", () => {
    const docked = vesicles(4);
    expect(docked).toHaveLength(4);
    Arr.forEach(docked, (item) => {
      expect(item.docked).toBe(true);
      expect(item.centre[1] - item.radius).toBeCloseTo(CLEFT + BILAYER + 0.02);
      expect(item.centre[2]).toBe(ROW.docked);
    });
  });

  it("cluster behind the docked ones, each clear of the others", () => {
    const placed = vesicles(40);
    expect(placed).toHaveLength(40);
    Arr.forEach(Arr.drop(placed, 4), (item, index) => {
      expect(item.docked).toBe(false);
      expect(item.centre[1]).toBeGreaterThanOrEqual(8.2);
      expect(item.centre[1]).toBeLessThanOrEqual(14.6);
      expect(fitsVesicle(item, Arr.take(placed, index + 4))).toBe(true);
    });
  });
});

describe("membrane proteins", () => {
  it("stand the presynaptic proteins on the bouton's face", () => {
    expect(CHANNELS).toHaveLength(7);
    expect(TRANSPORTERS).toHaveLength(4);
    Arr.forEach(Arr.appendAll(CHANNELS, TRANSPORTERS), ([x, y, z]) => {
      expect(y).toBeCloseTo(boutonFace(Math.hypot(x, z)));
    });
    Arr.forEach(PROJECTIONS, ([x, y, z]) => {
      expect(y).toBeCloseTo(boutonFace(Math.hypot(x, z)) + BILAYER);
      expect(z).toBe(ROW.projection);
    });
  });

  it("anchors acetylcholinesterase on the dendrite's face", () => {
    expect(ENZYMES).toHaveLength(10);
    Arr.forEach(ENZYMES, ([, y, z]) => {
      expect(y).toBeCloseTo(dendriteTop(z));
    });
  });

  it("packs the receptors across the density, clear of every enzyme", () => {
    const field = receptors();
    expect(field).toHaveLength(188);
    Arr.forEach(field, ([x, y, z]) => {
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(DENSITY);
      expect(z).toBeLessThan(0);
      expect(y).toBeCloseTo(dendriteTop(z));
      Arr.forEach(ENZYMES, ([ex, , ez]) => {
        expect(Math.hypot(x - ex, z - ez)).toBeGreaterThanOrEqual(1.15);
      });
    });
  });
});

describe("release", () => {
  it("opens the two middle docked vesicles on the bouton's face", () => {
    expect(RELEASE).toHaveLength(2);
    Arr.forEach(RELEASE, ([x, y, z]) => {
      expect(z).toBe(ROW.docked);
      expect(y).toBeCloseTo(boutonFace(Math.hypot(x, z)));
    });
  });

  it("orders the receptors nearest the release sites first", () => {
    const field = receptors();
    const near = nearest(field, 12);
    expect(near).toHaveLength(12);
    Arr.forEach(Arr.drop(near, 1), (item, index) => {
      const before = near[index];
      expect(
        before === undefined ? Number.NaN : toRelease(before)
      ).toBeLessThanOrEqual(toRelease(item));
    });
    expect(nearest(field, field.length)).toHaveLength(field.length);
  });
});
