import { describe, expect, it } from "@effect/vitest";
import { evaluateContactStage } from "@repo/design-system/components/contents/chemistry/contact/model";

describe("contact sulfuric acid process model", () => {
  it("progresses from roasting through V2O5 oxidation and oleum absorption to dilution", () => {
    const r = evaluateContactStage("roasting");
    const c = evaluateContactStage("catalyticOxidation");
    const o = evaluateContactStage("oleumAbsorption");
    const d = evaluateContactStage("dilution");

    expect(r.activeX).toBeLessThan(c.activeX);
    expect(c.temperatureC).toBe(450);
    expect(o.activeX).toBeLessThan(d.activeX);
    expect(d.temperatureC).toBeLessThan(c.temperatureC);
  });
});
