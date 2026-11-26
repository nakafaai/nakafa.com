import { describe, expect, it } from "@effect/vitest";
import { evaluateGalvanicCell } from "@repo/design-system/components/contents/chemistry/bridge/model";

describe("salt bridge galvanic cell model", () => {
  it("ranks cell EMF from Mg/Cu down to Cu/Ag", () => {
    const mgCu = evaluateGalvanicCell("magnesiumCopper");
    const znCu = evaluateGalvanicCell("daniell");
    const cuAg = evaluateGalvanicCell("copperSilver");

    expect(mgCu.emfVolts).toBeGreaterThan(znCu.emfVolts);
    expect(znCu.emfVolts).toBeGreaterThan(cuAg.emfVolts);
    expect(znCu.anodeSymbol).toBe("Zn");
  });
});
