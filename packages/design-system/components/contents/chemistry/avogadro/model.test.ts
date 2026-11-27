import { describe, expect, it } from "@effect/vitest";
import { evaluateAvogadroGas } from "@repo/design-system/components/contents/chemistry/avogadro/model";

describe("avogadro molar gas volume model", () => {
  it("scales volume linearly with moles at STP (22.4 dm3/mol) and RTP (24.0 dm3/mol)", () => {
    const stp = evaluateAvogadroGas("stp", 1);
    const rtp = evaluateAvogadroGas("rtp", 1);
    const doubleRtp = evaluateAvogadroGas("rtp", 2);

    expect(stp.volumeDm3).toBe(22.4);
    expect(rtp.volumeDm3).toBe(24);
    expect(doubleRtp.volumeDm3).toBe(48);
    expect(stp.moleculesMath).toBe("6.02 \\times 10^{23}");
  });
});
