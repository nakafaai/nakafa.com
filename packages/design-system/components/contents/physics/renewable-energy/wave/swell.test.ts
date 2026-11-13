import { describe, expect, it } from "@effect/vitest";
import {
  SEA_STATES,
  surfaceHeight,
  wavelength,
  wavePower,
  waveSpeed,
} from "@repo/design-system/components/contents/physics/renewable-energy/wave/swell";

describe("ocean waves", () => {
  it("carries ρ g² H² T / (64π) across each metre of crest", () => {
    expect(wavePower("calm")).toBeCloseTo(2943.6, 0);
    expect(wavePower("moderate")).toBeCloseTo(15_699.3, 0);
    expect(wavePower("rough")).toBeCloseTo(44_154.6, 0);
  });

  it("brings four times the power for twice the height at the same period", () => {
    const { height, period } = SEA_STATES.calm;
    const doubled =
      (1025 * 9.81 * 9.81 * (2 * height) ** 2 * period) / (64 * Math.PI);
    expect(doubled / wavePower("calm")).toBeCloseTo(4, 9);
  });

  it("stretches the wave to g T² / (2π) and moves it one length each period", () => {
    expect(wavelength("calm")).toBeCloseTo(56.2, 1);
    expect(wavelength("rough")).toBeCloseTo(156.1, 1);
    expect(waveSpeed("moderate") * SEA_STATES.moderate.period).toBeCloseTo(
      wavelength("moderate"),
      9
    );
  });

  it("lifts the surface half the wave height at a crest and repeats after one length", () => {
    expect(surfaceHeight("moderate", 0, 0)).toBeCloseTo(1, 9);
    expect(
      surfaceHeight("moderate", wavelength("moderate") / 2, 0)
    ).toBeCloseTo(-1, 9);
    expect(surfaceHeight("moderate", 30, 3)).toBeCloseTo(
      surfaceHeight("moderate", 30 + wavelength("moderate"), 3),
      9
    );
  });
});
