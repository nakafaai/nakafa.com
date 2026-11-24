import { describe, expect, it } from "@effect/vitest";
import {
  bondCount,
  chainNodes,
  monomersOf,
  POLYSACCHARIDES,
  SUGARS,
} from "@repo/design-system/components/contents/biology/sugar/polymer";
import { Array as Arr } from "effect";

describe("monomersOf", () => {
  it("maps maltose, sucrose, and lactose to their exact monomer pairs", () => {
    expect(monomersOf("maltose")).toEqual(["glucose", "glucose"]);
    expect(monomersOf("sucrose")).toEqual(["glucose", "fructose"]);
    expect(monomersOf("lactose")).toEqual(["glucose", "galactose"]);
    expect(SUGARS).toHaveLength(3);
  });
});

describe("bondCount", () => {
  it("returns units - 1 glycosidic bonds and never goes below zero", () => {
    expect(bondCount(2)).toBe(1);
    expect(bondCount(10)).toBe(9);
    expect(bondCount(1)).toBe(0);
  });
});

describe("chainNodes", () => {
  it("builds 3D layouts for starch, glycogen with branches, and two-row cellulose", () => {
    for (const poly of POLYSACCHARIDES) {
      expect(chainNodes(poly, 12)).toHaveLength(12);
    }
    const glycogen = chainNodes("glycogen", 12);
    expect(Arr.some(glycogen, (node) => node.branch)).toBe(true);
    const cellulose = chainNodes("cellulose", 10);
    expect(Arr.some(cellulose, (node) => node.row === 1)).toBe(true);
  });
});
