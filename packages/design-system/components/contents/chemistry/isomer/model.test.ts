import { describe, expect, it } from "@effect/vitest";
import { evaluateIsomerGeometry } from "@repo/design-system/components/contents/chemistry/isomer/model";

describe("alkane alkene isomer model", () => {
  it("distinguishes saturated C4 alkanes from unsaturated C4 alkenes", () => {
    expect(evaluateIsomerGeometry("butane").unsaturated).toBe(false);
    expect(evaluateIsomerGeometry("methylpropane").carbons.length).toBe(4);
    expect(evaluateIsomerGeometry("but1ene").doubleBondIndex).toBe(0);
    expect(evaluateIsomerGeometry("but2ene").doubleBondIndex).toBe(1);
  });
});
