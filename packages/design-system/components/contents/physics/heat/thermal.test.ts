import { describe, expect, it } from "@effect/vitest";
import {
  gasPressure,
  latentFromHeating,
  meltIce,
} from "@repo/design-system/components/contents/physics/heat/thermal";

describe("meltIce", () => {
  it("melts 50 g of ice in 200 g of water at 30 degrees and settles at 8 degrees", () => {
    const mixture = meltIce({
      ice: 0.05,
      latent: 3.36e5,
      specific: 4200,
      temperature: 30,
      water: 0.2,
    });
    expect(mixture.melt).toBeCloseTo(16_800, 9);
    expect(mixture.given).toBeCloseTo(25_200, 9);
    expect(mixture.final).toBeCloseTo(8, 9);
    expect(mixture.melted).toBe(0.05);
  });

  it("leaves some ice at 0 degrees when the water cannot melt it all", () => {
    const mixture = meltIce({
      ice: 0.2,
      latent: 3.36e5,
      specific: 4200,
      temperature: 30,
      water: 0.2,
    });
    expect(mixture.final).toBe(0);
    expect(mixture.melted).toBeCloseTo(0.075, 9);
  });
});

describe("gasPressure", () => {
  it("raises 150 kPa to 400 kPa when the volume halves and the gas warms from 27 to 127 degrees", () => {
    expect(gasPressure(150, 0.5, { from: 27, to: 127 })).toBeCloseTo(400, 9);
  });
});

describe("latentFromHeating", () => {
  it("finds 1.0 x 10^5 J/kg from 5.0 minutes of melting and a 20 degree rise in 2.0 minutes", () => {
    const sample = latentFromHeating({
      mass: 0.2,
      melt: 300,
      rise: 20,
      specific: 2000,
      warm: 120,
    });
    expect(sample.power).toBeCloseTo(66.67, 2);
    expect(sample.latent).toBeCloseTo(1e5, 6);
  });
});
