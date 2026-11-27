import { describe, expect, it } from "@effect/vitest";
import { waveVectors } from "@repo/design-system/components/contents/physics/waves/tank/ripple";

const wave = { incidence: 30, speed: 20, wavelength: 2 };

describe("waveVectors", () => {
  it("keeps the part of the wave vector along the boundary, which is Snell's law", () => {
    const vectors = waveVectors(wave, 12, 1);
    expect(vectors.shallow[0]).toBeCloseTo(vectors.deep[0], 9);
  });

  it("shortens 2.0 cm to 1.2 cm where the speed falls from 20 to 12 cm/s", () => {
    const vectors = waveVectors(wave, 12, 1);
    expect((2 * Math.PI) / Math.hypot(...vectors.deep)).toBeCloseTo(2, 9);
    expect((2 * Math.PI) / Math.hypot(...vectors.shallow)).toBeCloseTo(1.2, 9);
  });

  it("scales with the scene: a wavelength of two units at half a unit each is one unit long", () => {
    const vectors = waveVectors(wave, 12, 0.5);
    expect((2 * Math.PI) / Math.hypot(...vectors.deep)).toBeCloseTo(1, 9);
  });
});
