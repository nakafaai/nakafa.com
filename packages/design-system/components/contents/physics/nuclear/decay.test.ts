import { describe, expect, it } from "@effect/vitest";
import {
  fissionEnergy,
  halfLifeFromReadings,
  photoelectric,
  recordedRate,
} from "@repo/design-system/components/contents/physics/nuclear/decay";

describe("halfLifeFromReadings", () => {
  it("finds a 6.0 hour half-life from 520 and 145 counts per minute over a background of 20", () => {
    const sample = halfLifeFromReadings({ first: 520, later: 145 }, 20, 12);
    expect(sample.start).toBe(500);
    expect(sample.end).toBe(125);
    expect(sample.halfLife).toBeCloseTo(6, 9);
    expect(recordedRate({ halfLife: 6, start: 500 }, 20, 12)).toBeCloseTo(
      145,
      9
    );
  });
});

describe("fissionEnergy", () => {
  it("releases about 2.78 x 10^-11 J from a mass defect of 0.1859 u", () => {
    const fission = fissionEnergy(
      {
        after: [140.9144, 91.9262, 1.0087, 1.0087, 1.0087],
        before: [235.0439, 1.0087],
      },
      { atomic: 1.66e-27, light: 3e8 }
    );
    expect(fission.defect).toBeCloseTo(0.1859, 9);
    expect(fission.energy).toBeCloseTo(2.777e-11, 13);
  });
});

describe("photoelectric", () => {
  const constants = { charge: 1.6e-19, light: 3e8, planck: 6.63e-34 };

  it("frees electrons with up to 0.8 eV from a 2.3 eV metal under 400 nm light", () => {
    const violet = photoelectric(400, 2.3, constants);
    expect(violet.energy).toBeCloseTo(3.108, 3);
    expect(violet.kinetic).toBeCloseTo(0.808, 3);
    expect(violet.emits).toBe(true);
  });

  it("frees none under 600 nm light, however bright", () => {
    const orange = photoelectric(600, 2.3, constants);
    expect(orange.emits).toBe(false);
    expect(orange.kinetic).toBe(0);
  });
});
