import { describe, expect, it } from "@effect/vitest";
import { evaluateCondensationPolymer } from "@repo/design-system/components/contents/chemistry/nylon/model";

describe("condensation polymer model", () => {
  it("distinguishes nylon-6,6 amide linkages from terylene ester linkages", () => {
    const nylon = evaluateCondensationPolymer("nylon66");
    const terylene = evaluateCondensationPolymer("terylene");

    expect(nylon.isAmide).toBe(true);
    expect(nylon.linkLabel).toBe("-CONH-");
    expect(terylene.isAmide).toBe(false);
    expect(terylene.linkLabel).toBe("-COO-");
  });
});
