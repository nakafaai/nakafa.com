import { describe, expect, it } from "@effect/vitest";
import {
  carbonMass,
  dioxideMass,
  dioxidePerMegajoule,
  dioxideVolume,
  FUEL_MASS,
  oxygenTaken,
} from "@repo/design-system/components/contents/physics/renewable-energy/carbon/combustion";

describe("burning a fossil fuel", () => {
  it("turns each 12 g of carbon into 44 g of carbon dioxide", () => {
    expect(dioxideMass("methane")).toBeCloseTo(2.75, 9);
    expect(dioxideMass("coal")).toBeCloseTo(2.5667, 4);
    expect(dioxideMass("diesel")).toBeCloseTo(3.1533, 4);
  });

  it("makes more gas than fuel, the extra mass being oxygen from the air", () => {
    expect(dioxideMass("coal")).toBeGreaterThan(FUEL_MASS);
    expect(carbonMass("coal") + oxygenTaken("coal")).toBeCloseTo(
      dioxideMass("coal"),
      9
    );
    expect(oxygenTaken("methane")).toBeCloseTo(2, 9);
  });

  it("fills about 1.5 m³ with the gas from 1 kg of methane", () => {
    expect(dioxideVolume("methane")).toBeCloseTo(1.531, 3);
  });

  it("releases the least gas per megajoule from methane and the most from coal", () => {
    expect(dioxidePerMegajoule("coal")).toBeCloseTo(106.9, 1);
    expect(dioxidePerMegajoule("diesel")).toBeCloseTo(73.3, 1);
    expect(dioxidePerMegajoule("methane")).toBeCloseTo(55, 9);
  });
});
