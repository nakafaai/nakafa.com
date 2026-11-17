import { describe, expect, it } from "@effect/vitest";
import {
  echo,
  fringeSpacing,
  fringesInSpan,
  loudPoints,
  refractWave,
  twoSourceIntensity,
} from "@repo/design-system/components/contents/physics/waves/wave";

describe("refractWave", () => {
  it("keeps 10 Hz into shallow water, shortens 2.0 cm to 1.2 cm and bends 30 degrees to about 17", () => {
    const shallow = refractWave(
      { incidence: 30, speed: 20, wavelength: 2 },
      12
    );
    expect(shallow.frequency).toBe(10);
    expect(shallow.wavelength).toBeCloseTo(1.2, 9);
    expect(shallow.refraction).toBeCloseTo(17.46, 2);
  });

  it("caps the angle at 90 degrees when a faster region cannot carry the wave on", () => {
    expect(
      refractWave({ incidence: 80, speed: 10, wavelength: 1 }, 20).refraction
    ).toBe(90);
  });
});

describe("fringeSpacing", () => {
  it("spaces fringes 4.5 mm apart for 600 nm light, 0.20 mm slits and a screen 1.5 m away", () => {
    expect(fringeSpacing(600e-9, 0.2e-3, 1.5) * 1000).toBeCloseTo(4.5, 9);
  });

  it("counts seven bright fringes in 27 mm, both ends included", () => {
    expect(fringesInSpan(27, 4.5)).toBe(7);
  });
});

describe("twoSourceIntensity", () => {
  const sources = { distance: 6, separation: 1.5, wavelength: 0.3 };

  it("is loudest straight opposite the middle of the speakers", () => {
    expect(twoSourceIntensity(sources, 0)).toBe(1);
  });

  it("is nearly silent half a fringe from the middle", () => {
    expect(twoSourceIntensity(sources, 0.6)).toBeLessThan(0.02);
  });
});

describe("loudPoints", () => {
  it("finds the loud points about 1.2 m apart along a line 6.0 m from speakers 1.5 m apart", () => {
    const points = loudPoints(
      { distance: 6, separation: 1.5, wavelength: 0.3 },
      3
    );
    expect(points).toHaveLength(5);
    expect(points[2]).toBeCloseTo(0, 6);
    expect(points[3]).toBeCloseTo(1.23, 2);
  });

  it("skips the order whose path difference equals the separation, which no point reaches", () => {
    expect(
      loudPoints({ distance: 1, separation: 1, wavelength: 1 }, 100)
    ).toHaveLength(1);
  });
});

describe("echo", () => {
  it("puts the boat 700 m from the cliff when it hears the echo 4.0 s later", () => {
    expect(echo(10, 340, 4)).toEqual({ back: 660, start: 700, travelled: 40 });
  });
});
