import { describe, expect, it } from "@effect/vitest";
import {
  blastomeres,
  clampDay,
  embryoAt,
  STAGES,
} from "@repo/design-system/components/contents/biology/implantation/cleavage";
import { Array as Arr } from "effect";

describe("clampDay and embryoAt", () => {
  it("tracks cleavage stages, shrinking cell shares, and HCG release at implantation", () => {
    expect(clampDay(-3)).toBe(0);
    expect(clampDay(20)).toBe(9);
    expect(embryoAt(0)).toMatchObject({
      cells: 1,
      hcg: false,
      share: "1 / 1",
      stage: "zygote",
    });
    expect(embryoAt(1).cells).toBe(2);
    expect(embryoAt(2).cells).toBe(4);
    expect(embryoAt(3).cells).toBe(16);
    expect(embryoAt(4).cells).toBe(32);
    expect(embryoAt(5).stage).toBe("blastocyst");
    expect(embryoAt(8)).toMatchObject({
      cells: 100,
      hcg: true,
      share: "1 / 100",
      stage: "implanting",
    });
  });
});

describe("blastomeres", () => {
  it("builds cell layouts for every cleavage stage including trophoblast and inner cell mass", () => {
    for (const stage of STAGES) {
      expect(blastomeres(stage).length).toBeGreaterThan(0);
    }
    const blasto = blastomeres("blastocyst");
    expect(Arr.some(blasto, (cell) => !cell.inner)).toBe(true);
    expect(Arr.some(blasto, (cell) => cell.inner)).toBe(true);
  });
});
