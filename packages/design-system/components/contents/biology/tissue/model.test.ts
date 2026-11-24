import { describe, expect, it } from "@effect/vitest";
import { tissueProfile } from "@repo/design-system/components/contents/biology/tissue/model";

describe("tissueProfile", () => {
  it("marks sclerenchyma and xylem as dead lignified tissues with thick walls", () => {
    const sclerenchyma = tissueProfile("sclerenchyma");
    const xylem = tissueProfile("xylem");

    expect(sclerenchyma).toEqual({
      lignified: true,
      status: "dead",
      wallScale: 1,
    });
    expect(xylem).toEqual({
      lignified: true,
      status: "dead",
      wallScale: 0.9,
    });
  });

  it("marks living tissues with distinct non-lignified wall thicknesses", () => {
    expect(tissueProfile("meristem").status).toBe("living");
    expect(tissueProfile("epidermis").wallScale).toBe(0.35);
    expect(tissueProfile("parenchyma").lignified).toBe(false);
    expect(tissueProfile("collenchyma").wallScale).toBeGreaterThan(
      tissueProfile("parenchyma").wallScale
    );
    expect(tissueProfile("phloem")).toEqual({
      lignified: false,
      status: "living",
      wallScale: 0.45,
    });
  });
});
