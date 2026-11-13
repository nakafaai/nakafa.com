import { describe, expect, it } from "@effect/vitest";
import { getMolecule } from "@repo/design-system/components/contents/chemistry/molecule/catalog";
import {
  compositionTex,
  massTex,
  shapeTex,
} from "@repo/design-system/components/contents/chemistry/molecule/facts";
import { Option, Result } from "effect";

/** Writes a number the way an Indonesian reader writes it, to one decimal. */
function indonesian(value: number) {
  return new Intl.NumberFormat("id", {
    maximumFractionDigits: 1,
    useGrouping: false,
  })
    .format(value)
    .replaceAll(",", "{,}");
}

describe("molecule facts", () => {
  it("lists the atoms of a molecule with their counts", () => {
    expect(compositionTex("water")).toBe(
      "2\\,\\mathrm{H},\\ 1\\,\\mathrm{O}"
    );
  });

  it("sums the relative molecular mass from each element", () => {
    expect(massTex("water", indonesian)).toBe("M_r = 2(1) + 16 = 18");
    expect(massTex("hydrogen-chloride", indonesian)).toBe(
      "M_r = 1 + 35{,}5 = 36{,}5"
    );
  });

  it("measures the teaching angle of a bent molecule", () => {
    const water = Result.getOrThrow(getMolecule("water"));

    expect(shapeTex(water, indonesian)).toEqual(
      Option.some("\\angle\\,\\mathrm{HOH} = 104{,}5^\\circ")
    );
  });

  it("measures the bond length of a molecule of two atoms", () => {
    const chlorine = Result.getOrThrow(getMolecule("chlorine"));

    expect(shapeTex(chlorine, indonesian)).toEqual(
      Option.some("\\mathrm{Cl{-}Cl} = 198{,}8\\ \\mathrm{pm}")
    );
  });

  it("reads nothing when the named atoms are missing", () => {
    expect(Option.isNone(shapeTex({ atoms: [] }, indonesian))).toBe(true);
    expect(
      Option.isNone(
        shapeTex({ angle: { arms: [0, 1], vertex: 2 }, atoms: [] }, indonesian)
      )
    ).toBe(true);
  });
});
