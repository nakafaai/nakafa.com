import { describe, expect, it } from "@effect/vitest";
import {
  frequency,
  orbitRadius,
  photonEnergy,
  visibleColor,
  wavelength,
} from "@repo/design-system/components/contents/chemistry/emission/spectrum";
import { Option } from "effect";

describe("hydrogen spectrum", () => {
  it("gives the Balmer lines at their measured vacuum wavelengths", () => {
    expect(wavelength(3, 2)).toBeCloseTo(656.47, 1);
    expect(wavelength(4, 2)).toBeCloseTo(486.27, 1);
    expect(wavelength(5, 2)).toBeCloseTo(434.17, 1);
    expect(wavelength(6, 2)).toBeCloseTo(410.29, 1);
  });

  it("puts Lyman in the ultraviolet and Paschen in the infrared", () => {
    expect(wavelength(2, 1)).toBeCloseTo(121.57, 1);
    expect(wavelength(4, 3)).toBeCloseTo(1875.6, 0);
  });

  it("works out the photon's energy and frequency", () => {
    expect(photonEnergy(3, 2)).toBeCloseTo(1.889, 3);
    expect(frequency(3, 2)).toBeCloseTo(4.5668e14, -11);
    expect(orbitRadius(3)).toBe(9);
  });

  it("colors visible light and leaves ultraviolet and infrared unseen", () => {
    expect(visibleColor(656.47)).toEqual(Option.some([1, 0, 0]));
    expect(Option.isNone(visibleColor(121.57))).toBe(true);
    expect(Option.isNone(visibleColor(1875.6))).toBe(true);
    const violet = Option.getOrThrow(visibleColor(410.29));
    expect(violet[2]).toBeCloseTo(0.3 + (0.7 * 30.29) / 40, 2);
    const deep = Option.getOrThrow(visibleColor(760));
    expect(deep[0]).toBeCloseTo(0.475, 3);
  });
});
