import { describe, expect, it } from "@effect/vitest";
import {
  atomEconomy,
  balanceLines,
  economyLines,
  equationLines,
  getReaction,
  massBalanceTex,
  moleculeCountTex,
  ReactionIdSchema,
  sideAtoms,
} from "@repo/design-system/components/contents/chemistry/equation/catalog";
import { Option } from "effect";

/** Writes a number the way an Indonesian reader writes it, to one decimal. */
function indonesian(value: number) {
  return new Intl.NumberFormat("id", {
    maximumFractionDigits: 1,
    useGrouping: false,
  })
    .format(value)
    .replaceAll(",", "{,}");
}

describe("reaction catalog", () => {
  it("balances every reaction atom for atom", () => {
    for (const id of ReactionIdSchema.literals) {
      const { products, reactants } = getReaction(id);

      expect(sideAtoms(products)).toEqual(sideAtoms(reactants));
    }
  });

  it("writes the balanced equation with its coefficients", () => {
    expect(equationLines("water-synthesis")).toEqual([
      "2\\,\\mathrm{H_2} + \\mathrm{O_2}",
      "\\rightarrow 2\\,\\mathrm{H_2O}",
    ]);
    expect(equationLines("propane-combustion")).toEqual([
      "\\mathrm{C_3H_8} + 5\\,\\mathrm{O_2}",
      "\\rightarrow 3\\,\\mathrm{CO_2} + 4\\,\\mathrm{H_2O}",
    ]);
  });

  it("counts the atoms of each element on both sides", () => {
    expect(balanceLines("methane-combustion")).toEqual([
      "\\mathrm{H}: 4 = 4",
      "\\mathrm{C}: 1 = 1",
      "\\mathrm{O}: 4 = 4",
    ]);
  });

  it("keeps the mass of both sides equal", () => {
    expect(massBalanceTex("water-synthesis", indonesian)).toBe("36 = 36");
    expect(massBalanceTex("hydrogen-chloride-synthesis", indonesian)).toBe(
      "73 = 73"
    );
  });

  it("counts the molecules, which a reaction may change", () => {
    expect(moleculeCountTex("ammonia-synthesis")).toBe("4 \\rightarrow 2");
  });

  it("works out the atom economy of the wanted product", () => {
    expect(atomEconomy("ethene-hydration")).toEqual(Option.some(100));
    expect(atomEconomy("carbon-monoxide-methanol")).toEqual(Option.some(100));
    expect(economyLines("ethanol-dehydration", indonesian)).toEqual(
      Option.some(["\\dfrac{28}{46} \\times 100\\%", "= 60{,}9\\%"])
    );
    expect(economyLines("methanol-synthesis", indonesian)).toEqual(
      Option.some(["\\dfrac{32}{50} \\times 100\\%", "= 64\\%"])
    );
    expect(economyLines("water-synthesis", indonesian)).toEqual(
      Option.some(["\\dfrac{2(18)}{36} \\times 100\\%", "= 100\\%"])
    );
  });
});
