import { describe, expect, it } from "@effect/vitest";
import { nuclideSpec } from "@repo/design-system/components/contents/physics/binding/model";

describe("nuclear binding curve model", () => {
  it("peaks at iron-56 above both light fusion nuclides and uranium-235", () => {
    const d = nuclideSpec("deuterium");
    const he = nuclideSpec("helium4");
    const c = nuclideSpec("carbon12");
    const fe = nuclideSpec("iron56");
    const u = nuclideSpec("uranium235");

    expect(fe.bindingPerNucleonMev).toBeGreaterThan(d.bindingPerNucleonMev);
    expect(fe.bindingPerNucleonMev).toBeGreaterThan(he.bindingPerNucleonMev);
    expect(fe.bindingPerNucleonMev).toBeGreaterThan(c.bindingPerNucleonMev);
    expect(fe.bindingPerNucleonMev).toBeGreaterThan(u.bindingPerNucleonMev);
    expect(u.massDefectU).toBeGreaterThan(fe.massDefectU);
  });
});
