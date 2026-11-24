import { describe, expect, it } from "@effect/vitest";
import {
  curvePoints,
  ovulationDay,
  phaseAt,
  snapshotAt,
} from "@repo/design-system/components/contents/biology/menstrual/hormones";

describe("ovulationDay and phaseAt", () => {
  it("places ovulation luteal days before cycle end and detects every phase", () => {
    expect(ovulationDay(28, 14)).toBe(14);
    expect(ovulationDay(35, 14)).toBe(21);
    expect(phaseAt(2, 28, 14, "cycle")).toBe("menstruation");
    expect(phaseAt(9, 28, 14, "cycle")).toBe("follicle");
    expect(phaseAt(14, 28, 14, "cycle")).toBe("ovulation");
    expect(phaseAt(19, 28, 14, "cycle")).toBe("luteal");
    expect(phaseAt(24, 28, 14, "pregnancy")).toBe("pregnancy");
    expect(phaseAt(25, 28, 14, "miscarriage")).toBe("miscarriage");
  });
});

describe("snapshotAt and curvePoints", () => {
  it("peaks LH at ovulation, sustains progesterone with HCG in pregnancy, and drops progesterone in miscarriage", () => {
    const ov = snapshotAt(14, 28, 14, "cycle");
    expect(ov.lh).toBeGreaterThan(0.9);
    const preg = snapshotAt(26, 28, 14, "pregnancy");
    expect(preg.hcg).toBeGreaterThan(0.5);
    expect(preg.progesterone).toBeGreaterThan(0.8);
    expect(preg.lining).toBeGreaterThan(0.9);

    const misc = snapshotAt(26, 28, 14, "miscarriage");
    expect(misc.progesterone).toBeLessThan(0.25);
    expect(misc.lining).toBeLessThan(0.35);

    const lateCycle = snapshotAt(27, 28, 14, "cycle");
    expect(lateCycle.lining).toBeGreaterThan(0.4);

    expect(curvePoints("lh", 28, 14, "cycle")).toHaveLength(28);
  });
});
