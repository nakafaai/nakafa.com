// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  arch,
  attachment,
  BODY,
  bodyPoint,
  CRISTA_HALF,
  CRISTAE,
  cristaPoint,
  cristaReach,
  cristaX,
  EMPHASIS,
  FILLET,
  FRONT,
  facePoint,
  GAP_COUNT,
  gapClearance,
  gapMiddle,
  gapPoint,
  INSET,
  INTERMEMBRANE,
  LANES,
  MEMBRANE,
  QUIET_GAPS,
  sectionRadius,
  swell,
  wallReach,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import { compartmentOf } from "@repo/design-system/components/contents/biology/mitochondrion/test/compartment";
import { Array as Arr } from "effect";

/** Angles round the kept half, from the bottom edge of the cut to the top. */
const ANGLES = Arr.map(
  Arr.range(0, 20),
  (step) => Math.PI + (step / 20) * Math.PI
);

describe("the mitochondrion's body", () => {
  it("keeps a real organelle's size: 0.5 to 1 µm across and 1 to 8 µm long", () => {
    expect(2 * BODY.radius).toBeGreaterThanOrEqual(0.5);
    expect(2 * BODY.radius).toBeLessThanOrEqual(1);
    expect(BODY.length).toBeGreaterThanOrEqual(1);
    expect(BODY.length).toBeLessThanOrEqual(8);
  });

  it("draws each membrane 7 nm and both with the space between them 22 nm, thickened alike", () => {
    expect(MEMBRANE).toBeCloseTo(0.007 * EMPHASIS, 12);
    expect(INSET.matrix).toBeCloseTo(0.022 * EMPHASIS, 12);
    expect(INSET.inner - INSET.outerBack).toBeCloseTo(INTERMEMBRANE, 12);
    expect(INSET.outer).toBeLessThan(INSET.outerBack);
    expect(INSET.outerBack).toBeLessThan(INSET.inner);
    expect(INSET.inner).toBeLessThan(INSET.matrix);
  });

  it("rounds off at both ends and bows gently in the middle", () => {
    expect(sectionRadius(0, 0)).toBe(BODY.radius);
    expect(sectionRadius(BODY.length / 2, 0)).toBeCloseTo(0, 12);
    expect(sectionRadius(BODY.length, 0)).toBe(0);
    expect(arch(0)).toBeGreaterThan(arch(0.9));
    expect(arch(-1)).toBeCloseTo(0, 12);
    for (const theta of ANGLES) {
      expect(Math.abs(swell(0.3, theta) - 1)).toBeLessThanOrEqual(0.03);
    }
  });

  it("runs every surface from tip to tip, its cut edges in the plane of the cut", () => {
    const left = bodyPoint(0, 1.5 * Math.PI, 0);
    const right = bodyPoint(1, 1.5 * Math.PI, INSET.matrix);
    expect(left[0]).toBeCloseTo(-BODY.length / 2, 12);
    expect(right[0]).toBeCloseTo(BODY.length / 2 - INSET.matrix, 12);
    expect(bodyPoint(0.5, Math.PI, 0)[2]).toBeCloseTo(0, 12);
    expect(bodyPoint(0.5, 2 * Math.PI, 0)[2]).toBeCloseTo(0, 12);
    expect(bodyPoint(0.5, 1.5 * Math.PI, 0)[2]).toBeLessThan(-0.38);
  });

  it("tells the cytoplasm, the intermembrane space and the matrix apart", () => {
    const at = (radius: number, theta: number): Point => [
      0,
      arch(0) + radius * Math.cos(theta),
      radius * Math.sin(theta),
    ];
    expect(compartmentOf(at(0.6, 1.5 * Math.PI))).toBe("cytoplasm");
    expect(
      compartmentOf(at(BODY.radius - MEMBRANE - 0.004, 1.5 * Math.PI))
    ).toBe("intermembrane");
    expect(compartmentOf(at(0.1, 1.5 * Math.PI))).toBe("matrix");
    expect(compartmentOf(at(0.1, 0.5 * Math.PI))).toBe("matrix");
    expect(compartmentOf([1.3, 0, 0])).toBe("cytoplasm");
  });
});

describe("the cristae", () => {
  it("fold out of the boundary membrane by slot junctions that run from the cut edge, on either side or both", () => {
    expect(CRISTAE).toHaveLength(9);
    expect(
      Arr.dedupe(Arr.map(CRISTAE, (crista) => crista.attach))
    ).toHaveLength(3);
    for (const crista of CRISTAE) {
      expect(crista.slots.length).toBe(crista.attach === "both" ? 2 : 1);
      for (const [from, to] of crista.slots) {
        expect(from).toBeGreaterThanOrEqual(Math.PI);
        expect(to).toBeLessThanOrEqual(2 * Math.PI);
        expect(from === Math.PI || to === 2 * Math.PI).toBe(true);
        expect(attachment(crista, (from + to) / 2)).toBe(1);
      }
    }
  });

  it("keep their free rims clear of the wall, with room for the synthase heads", () => {
    for (const crista of CRISTAE) {
      for (const theta of ANGLES) {
        if (attachment(crista, theta) === 0) {
          expect(
            wallReach(crista, theta) - cristaReach(crista, theta)
          ).toBeGreaterThanOrEqual(0.07);
        }
      }
    }
  });

  it("reach through the boundary membrane at a junction, the faces bending into it and the lumen opening into the intermembrane space", () => {
    const crista = Arr.getUnsafe(CRISTAE, 2);
    expect(crista.attach).toBe("bottom");
    const wall = wallReach(crista, Math.PI);
    expect(cristaReach(crista, Math.PI)).toBeCloseTo(
      wall + CRISTA_HALF + MEMBRANE,
      12
    );
    const radial = (point: Point) =>
      Math.hypot(point[1] - arch(crista.x), point[2]);
    const offset = (point: Point) =>
      point[0] - cristaX(crista, point[1], point[2]);
    const face = cristaPoint(crista, Math.PI, 0.75, 1);
    const lumen = cristaPoint(crista, Math.PI, 0.75, 1, MEMBRANE);
    expect(radial(face)).toBeCloseTo(wall + MEMBRANE, 12);
    expect(offset(face)).toBeCloseTo(CRISTA_HALF + FILLET, 12);
    expect(offset(lumen)).toBeCloseTo(CRISTA_HALF + FILLET, 6);
    expect(radial(lumen)).toBeCloseTo(
      sectionRadius(crista.x, INSET.inner) * swell(crista.x, Math.PI),
      3
    );
    const before = cristaPoint(crista, Math.PI, 0.3, 1);
    expect(offset(before)).toBeCloseTo(CRISTA_HALF, 12);
  });

  it("never touch a neighbour, leaving at least 80 nm of matrix between every two", () => {
    for (const gap of Arr.range(0, GAP_COUNT - 1)) {
      for (const theta of ANGLES) {
        for (const share of [0, 0.4, 0.8]) {
          const point = gapPoint(gap, theta, share);
          expect(gapClearance(gap, point)).toBeGreaterThan(0.04);
        }
      }
    }
  });

  it("join both faces in a rounded rim and close round the lumen one membrane in", () => {
    const crista = Arr.getUnsafe(CRISTAE, 4);
    const front = cristaPoint(crista, 1.5 * Math.PI, 1, 1);
    const back = cristaPoint(crista, 1.5 * Math.PI, 1, -1);
    expect(front[0]).toBeCloseTo(back[0], 12);
    const flat = cristaPoint(crista, 1.5 * Math.PI, 0.5, 1);
    expect(flat[0] - cristaX(crista, flat[1], flat[2])).toBeCloseTo(
      CRISTA_HALF,
      12
    );
    const lumen = cristaPoint(crista, 1.5 * Math.PI, 0.5, 1, MEMBRANE);
    expect(lumen[0] - cristaX(crista, lumen[1], lumen[2])).toBeCloseTo(
      CRISTA_HALF - MEMBRANE,
      12
    );
    const centre = cristaPoint(crista, Math.PI, 0, 0);
    expect(centre[1]).toBeCloseTo(arch(crista.x), 12);
    expect(centre[2]).toBeCloseTo(0, 12);
  });

  it("finds the middle of each gap and the points just off its crista faces", () => {
    const left = Arr.getUnsafe(CRISTAE, 2);
    const right = Arr.getUnsafe(CRISTAE, 3);
    const middle = gapMiddle(2, 0, 0);
    expect(middle).toBeGreaterThan(cristaX(left, 0, 0));
    expect(middle).toBeLessThan(cristaX(right, 0, 0));
    expect(gapPoint(2, Math.PI, 0.5, 0.01)[0]).toBeCloseTo(
      gapMiddle(2, gapPoint(2, Math.PI, 0.5)[1], 0) + 0.01,
      12
    );
    const nearLeft = facePoint(2, "left", 0.1, 0.05);
    const nearRight = facePoint(2, "right", 0.1, 0.05);
    expect(nearLeft[0] - cristaX(left, nearLeft[1], 0)).toBeCloseTo(
      CRISTA_HALF + 0.05,
      12
    );
    expect(cristaX(right, nearRight[1], 0) - nearRight[0]).toBeCloseTo(
      CRISTA_HALF + 0.05,
      12
    );
    expect(nearLeft[2]).toBe(FRONT);
  });

  it("keeps the molecules' lanes apart from the quiet gaps", () => {
    for (const lane of LANES) {
      for (const gap of lane) {
        expect(QUIET_GAPS).not.toContain(gap);
        expect(gap).toBeLessThan(GAP_COUNT);
      }
    }
  });
});
