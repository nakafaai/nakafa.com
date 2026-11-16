import { describe, expect, it } from "@effect/vitest";
import {
  cellEfficiency,
  cellTemperature,
  panelBalance,
} from "@repo/design-system/components/contents/physics/renewable-energy/panel/balance";

describe("solar panel energy balance", () => {
  it("heats the cells above the air in strong sun", () => {
    expect(cellTemperature(1000)).toBeCloseTo(61.25, 9);
    expect(cellTemperature(200)).toBeCloseTo(36.25, 9);
  });

  it("converts a smaller share when the cells are hotter", () => {
    expect(cellEfficiency(1000)).toBeCloseTo(0.171, 9);
    expect(cellEfficiency(200)).toBeLessThan(0.2);
    expect(cellEfficiency(200)).toBeGreaterThan(cellEfficiency(1000));
  });

  it("splits 1600 W of sunlight into electricity, reflection and heat", () => {
    const balance = panelBalance(1000);
    expect(balance.input).toBe(1600);
    expect(balance.electric).toBeCloseTo(273.6, 6);
    expect(balance.reflected).toBeCloseTo(64, 9);
    expect(balance.heat).toBeCloseTo(1262.4, 6);
  });

  it("accounts for every watt at any irradiance", () => {
    for (const irradiance of [200, 500, 800]) {
      const balance = panelBalance(irradiance);
      expect(balance.electric + balance.reflected + balance.heat).toBeCloseTo(
        balance.input,
        9
      );
    }
  });
});
