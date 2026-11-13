import { describe, expect, it } from "@effect/vitest";
import {
  incidenceAngle,
  panelIrradiance,
  panelPower,
} from "@repo/design-system/components/contents/physics/renewable-energy/sun/angle";

describe("solar panel angle", () => {
  it("catches 1000 sin α on a flat panel", () => {
    expect(panelIrradiance(30, 0)).toBeCloseTo(500, 9);
    expect(panelIrradiance(90, 0)).toBeCloseTo(1000, 9);
  });

  it("catches the full beam when the panel faces the sun", () => {
    expect(incidenceAngle(30, 60)).toBe(0);
    expect(panelIrradiance(30, 60)).toBeCloseTo(1000, 9);
  });

  it("loses light when tilted past the sun", () => {
    expect(incidenceAngle(80, 40)).toBe(30);
    expect(panelIrradiance(80, 40)).toBeCloseTo(866.03, 2);
  });

  it("turns a fifth of the light on 1.6 m² into electricity", () => {
    expect(panelPower(30, 0)).toBeCloseTo(160, 9);
    expect(panelPower(30, 60)).toBeCloseTo(320, 9);
  });
});
