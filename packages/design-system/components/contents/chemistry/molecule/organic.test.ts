import { describe, expect, it } from "@effect/vitest";
import {
  buildMolecule,
  measureAngle,
  measureDistance,
} from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import {
  ORGANIC_IDS,
  ORGANIC_SOURCES,
} from "@repo/design-system/components/contents/chemistry/molecule/organic";
import { Array as Arr, Result } from "effect";

/** The atoms and bonds of one organic molecule. */
function built(id: (typeof ORGANIC_IDS)[number]) {
  const source = ORGANIC_SOURCES[id];
  const molecule = Result.getOrThrow(buildMolecule(source.placements));
  return {
    ...molecule,
    elements: Arr.map(source.placements, (each) => each.element),
  };
}

/** How many atoms of one element a molecule holds. */
function count(id: (typeof ORGANIC_IDS)[number], element: string) {
  return Arr.filter(built(id).elements, (each) => each === element).length;
}

describe("organic molecules", () => {
  it("gives every hexane isomer the formula C6H14 and hex-1-ene C6H12", () => {
    for (const id of [
      "hexane",
      "methylpentane-2",
      "methylpentane-3",
      "dimethylbutane-22",
      "dimethylbutane-23",
    ] as const) {
      expect([count(id, "C"), count(id, "H")]).toEqual([6, 14]);
    }
    expect([count("hexene", "C"), count("hexene", "H")]).toEqual([6, 12]);
    expect([count("dibromohexane", "H"), count("dibromohexane", "Br")]).toEqual(
      [12, 2]
    );
    expect([
      count("propene", "H"),
      count("propanol", "H"),
      count("propanol", "O"),
    ]).toEqual([6, 8, 1]);
    expect([count("chloroethene", "H"), count("chloroethene", "Cl")]).toEqual([
      3, 1,
    ]);
  });

  it("sets the tetrahedral angle in a saturated chain and 120° at a double bond", () => {
    const hexane = built("hexane");
    const propene = built("propene");

    expect(
      measureAngle(
        hexane.positions[0],
        hexane.positions[1],
        hexane.positions[2]
      )
    ).toBeCloseTo(109.47, 1);
    expect(
      measureAngle(
        propene.positions[0],
        propene.positions[1],
        propene.positions[2]
      )
    ).toBeCloseTo(120, 6);
    expect(
      measureDistance(propene.positions[0], propene.positions[1])
    ).toBeCloseTo(134, 6);
    expect(Arr.some(propene.bonds, (bond) => bond.order === 2)).toBe(true);
  });

  it("keeps every pair of atoms in every molecule apart, so no two overlap", () => {
    for (const id of ORGANIC_IDS) {
      const { positions } = built(id);
      const closest = Arr.reduce(
        Arr.flatMap(positions, (a, i) =>
          Arr.map(Arr.drop(positions, i + 1), (b) => measureDistance(a, b))
        ),
        Number.POSITIVE_INFINITY,
        (least, distance) => Math.min(least, distance)
      );
      expect(closest, id).toBeGreaterThan(90);
    }
  });
});
