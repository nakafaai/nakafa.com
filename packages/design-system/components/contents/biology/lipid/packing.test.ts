import { describe, expect, it } from "@effect/vitest";
import {
  bilayerHeads,
  moleculeTails,
  roomState,
  tailPoints,
  waterForm,
} from "@repo/design-system/components/contents/biology/lipid/packing";

describe("roomState and waterForm", () => {
  it("maps saturated to solid, unsaturated to liquid, triglyceride to droplet, phospholipid to bilayer", () => {
    expect(roomState("saturated")).toBe("solid");
    expect(roomState("unsaturated")).toBe("liquid");
    expect(waterForm("triglyceride")).toBe("droplet");
    expect(waterForm("phospholipid")).toBe("bilayer");
  });
});

describe("tailPoints and moleculeTails", () => {
  it("bends unsaturated tails laterally after the double bond and builds 3 vs 2 tails", () => {
    const straight = tailPoints(0, 0.7, 0, false);
    const kinked = tailPoints(0, 0.7, 0, true);
    expect(straight).toHaveLength(8);
    expect(kinked[7]?.[0]).toBeGreaterThan((straight[7]?.[0] ?? 0) + 0.15);

    const tri = moleculeTails("triglyceride", "unsaturated");
    const pho = moleculeTails("phospholipid", "saturated");
    expect(tri).toHaveLength(3);
    expect(tri[2]?.kinked).toBe(true);
    expect(pho).toHaveLength(2);
    expect(pho[1]?.kinked).toBe(false);
  });
});

describe("bilayerHeads", () => {
  it("packs saturated leaflets tighter than unsaturated leaflets", () => {
    const sat = bilayerHeads("saturated");
    const unsat = bilayerHeads("unsaturated");
    expect(sat.length).toBeGreaterThan(unsat.length);
  });
});
