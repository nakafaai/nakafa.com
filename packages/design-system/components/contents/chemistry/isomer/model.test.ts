import { describe, expect, it } from "@effect/vitest";
import type { IsomerCompound } from "@repo/design-system/components/contents/chemistry/isomer/model";
import {
  isUnsaturated,
  moleculeOf,
} from "@repo/design-system/components/contents/chemistry/isomer/model";
import { Array as Arr } from "effect";

/** The lengths of a molecule's bonds between two atoms of the given elements, in angstrom. */
function lengthsOf(compound: IsomerCompound, first: string, second: string) {
  const molecule = moleculeOf(compound);
  return Arr.flatMap(molecule.bonds, (bond) => {
    const from = molecule.atoms[bond.from];
    const to = molecule.atoms[bond.to];
    if (
      from === undefined ||
      to === undefined ||
      from.element !== first ||
      to.element !== second
    ) {
      return [];
    }
    return [
      {
        length: Math.hypot(
          from.at[0] - to.at[0],
          from.at[1] - to.at[1],
          from.at[2] - to.at[2]
        ),
        order: bond.order,
      },
    ];
  });
}

describe("alkane alkene isomer model", () => {
  it("distinguishes saturated C4 alkanes from unsaturated C4 alkenes", () => {
    expect(isUnsaturated("butane")).toBe(false);
    expect(isUnsaturated("methylpropane")).toBe(false);
    expect(isUnsaturated("but1ene")).toBe(true);
    expect(isUnsaturated("but2ene")).toBe(true);
  });

  it("gives each isomer its molecular formula", () => {
    const count = (compound: IsomerCompound, element: string) =>
      Arr.filter(moleculeOf(compound).atoms, (atom) => atom.element === element)
        .length;
    expect(count("butane", "C")).toBe(4);
    expect(count("butane", "H")).toBe(10);
    expect(count("methylpropane", "H")).toBe(10);
    expect(count("but1ene", "H")).toBe(8);
    expect(count("but2ene", "H")).toBe(8);
  });

  it("draws real bond lengths, the double bond shortest", () => {
    expect(
      Arr.map(lengthsOf("butane", "C", "C"), (bond) => bond.length)
    ).toEqual([
      expect.closeTo(1.53, 5),
      expect.closeTo(1.53, 5),
      expect.closeTo(1.53, 5),
    ]);
    expect(
      Arr.map(lengthsOf("methylpropane", "C", "C"), (bond) => bond.length)
    ).toEqual([
      expect.closeTo(1.53, 5),
      expect.closeTo(1.53, 5),
      expect.closeTo(1.53, 5),
    ]);
    expect(lengthsOf("but1ene", "C", "C")).toEqual([
      { length: expect.closeTo(1.34, 5), order: 2 },
      { length: expect.closeTo(1.5, 5), order: 1 },
      { length: expect.closeTo(1.53, 5), order: 1 },
    ]);
    expect(lengthsOf("but2ene", "C", "C")[1]).toEqual({
      length: expect.closeTo(1.34, 5),
      order: 2,
    });
    expect(lengthsOf("butane", "C", "H")[0]?.length).toBeCloseTo(1.09, 2);
  });

  it("bends the chain by its real angles", () => {
    const [first, second, third] = moleculeOf("but2ene").atoms;
    const bend = (compound: IsomerCompound) => {
      const [a, b, c] = moleculeOf(compound).atoms;
      if (a === undefined || b === undefined || c === undefined) {
        return 0;
      }
      const toA = [a.at[0] - b.at[0], a.at[1] - b.at[1]] as const;
      const toC = [c.at[0] - b.at[0], c.at[1] - b.at[1]] as const;
      return (
        (Math.acos(
          (toA[0] * toC[0] + toA[1] * toC[1]) /
            (Math.hypot(...toA) * Math.hypot(...toC))
        ) *
          180) /
        Math.PI
      );
    };
    expect(first?.element).toBe("C");
    expect(second?.element).toBe("C");
    expect(third?.element).toBe("C");
    expect(bend("butane")).toBeCloseTo(112, 5);
    expect(bend("but2ene")).toBeCloseTo(124, 5);
  });
});
