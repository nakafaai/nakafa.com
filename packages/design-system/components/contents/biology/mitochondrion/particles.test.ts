// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  arch,
  CRISTA_HALF,
  CRISTAE,
  cristaReach,
  cristaX,
  EMPHASIS,
  INSET,
  sectionRadius,
  swell,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  COMPLEX,
  COMPLEXES,
  distance,
  GRANULE_RADIUS,
  GRANULES,
  MITORIBOSOMES,
  NUCLEOID_RADIUS,
  NUCLEOIDS,
  nucleoidLoop,
  RIBOSOME_RADIUS,
  SYNTHASE,
  SYNTHASES,
} from "@repo/design-system/components/contents/biology/mitochondrion/particles";
import { compartmentOf } from "@repo/design-system/components/contents/biology/mitochondrion/test/compartment";
import { Array as Arr } from "effect";

/** How far `point` lies from the organelle's axis. */
function radial([x, y, z]: readonly [number, number, number]) {
  return Math.hypot(y - arch(x), z);
}

describe("the proteins of the cristae", () => {
  it("draws ATP synthase heads 10 nm across, thickened as the membranes are", () => {
    expect(2 * SYNTHASE.head).toBeCloseTo(0.01 * EMPHASIS, 12);
    expect(SYNTHASE.lean * (180 / Math.PI)).toBeCloseTo(27, 12);
  });

  it("stands the synthases in rows on every crista rim, leaning to either face in turn", () => {
    expect(SYNTHASES.length).toBeGreaterThan(CRISTAE.length * 6);
    for (const synthase of SYNTHASES) {
      const crista = Arr.getUnsafe(CRISTAE, synthase.crista);
      const wall =
        sectionRadius(crista.x, INSET.matrix) * swell(crista.x, synthase.theta);
      expect(radial(synthase.head) + SYNTHASE.head).toBeLessThan(wall);
      expect(radial(synthase.foot)).toBeCloseTo(
        cristaReach(crista, synthase.theta),
        2
      );
      expect(synthase.head[2]).toBeLessThan(-SYNTHASE.head);
      expect(
        Math.sign(synthase.head[0] - synthase.foot[0]) * synthase.side
      ).toBe(1);
    }
  });

  it("studs both faces of every crista with respiratory chain complexes", () => {
    expect(COMPLEXES).toHaveLength(CRISTAE.length * 2 * 6);
    for (const complex of COMPLEXES) {
      expect([-1, 1]).toContain(complex.face);
      expect(complex.spin).toBeGreaterThanOrEqual(0);
    }
    expect(COMPLEX.lift).toBeLessThan(COMPLEX.width);
  });
});

describe("the matrix", () => {
  it("places two nucleoids, granules and mitochondrial ribosomes in the matrix", () => {
    expect(NUCLEOIDS).toHaveLength(2);
    expect(GRANULES).toHaveLength(7);
    expect(MITORIBOSOMES).toHaveLength(22);
    expect(2 * NUCLEOID_RADIUS).toBeCloseTo(0.07, 12);
    for (const [spots, size] of [
      [NUCLEOIDS, NUCLEOID_RADIUS],
      [GRANULES, GRANULE_RADIUS],
      [MITORIBOSOMES, RIBOSOME_RADIUS * 0.9],
    ] as const) {
      for (const spot of spots) {
        expect(compartmentOf(spot)).toBe("matrix");
        expect(spot[2] + size).toBeLessThan(0);
        for (const crista of CRISTAE) {
          expect(
            Math.abs(spot[0] - cristaX(crista, spot[1], spot[2]))
          ).toBeGreaterThan(CRISTA_HALF + size);
        }
      }
    }
  });

  it("keeps the matrix bodies apart from each other", () => {
    const all = Arr.appendAll(
      Arr.appendAll(NUCLEOIDS, GRANULES),
      MITORIBOSOMES
    );
    Arr.forEach(all, (spot, index) => {
      for (const other of Arr.drop(all, index + 1)) {
        expect(distance(spot, other)).toBeGreaterThan(2 * RIBOSOME_RADIUS);
      }
    });
  });

  it("winds each nucleoid's DNA within its 70 nm bundle", () => {
    const centre = Arr.getUnsafe(NUCLEOIDS, 0);
    const loop = nucleoidLoop(centre, 1, 24);
    expect(loop).toHaveLength(24);
    for (const point of loop) {
      expect(distance(point, centre)).toBeLessThan(NUCLEOID_RADIUS);
    }
  });
});
