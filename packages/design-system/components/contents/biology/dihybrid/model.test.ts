import { describe, expect, it } from "@effect/vitest";
import { evaluateDihybridGrid } from "@repo/design-system/components/contents/biology/dihybrid/model";
import { Array as Arr } from "effect";

describe("dihybrid 4x4 Punnett model", () => {
  it("yields the 9:3:3:1 phenotype distribution across filters", () => {
    const all = evaluateDihybridGrid("all");
    const dom = evaluateDihybridGrid("dominantBoth");
    const rec = evaluateDihybridGrid("recombinants");
    const doubleRec = evaluateDihybridGrid("recessiveBoth");

    expect(Arr.filter(all, (c) => c.highlighted).length).toBe(16);
    expect(Arr.filter(dom, (c) => c.highlighted).length).toBe(9);
    expect(Arr.filter(rec, (c) => c.highlighted).length).toBe(6);
    expect(Arr.filter(doubleRec, (c) => c.highlighted).length).toBe(1);
  });
});
