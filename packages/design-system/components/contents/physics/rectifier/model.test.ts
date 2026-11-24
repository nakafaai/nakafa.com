import { describe, expect, it } from "@effect/vitest";
import {
  evaluateRectifier,
  rectifiedOutput,
  sampleRectifierWave,
} from "@repo/design-system/components/contents/physics/rectifier/model";

describe("rectifier diode model", () => {
  it("computes half-wave, full-wave, and smoothed output waveforms", () => {
    const halfNeg = rectifiedOutput("halfWave", Math.PI * 1.5);
    const fullNeg = rectifiedOutput("fullWave", Math.PI * 1.5);
    const smoothZero = rectifiedOutput("smoothed", 0);

    expect(halfNeg).toBe(0);
    expect(fullNeg).toBeCloseTo(1, 5);
    expect(smoothZero).toBeGreaterThan(0.7);
  });

  it("raises DC average and reduces ripple from half-wave to smoothed", () => {
    const half = evaluateRectifier("halfWave", 12, 50);
    const full = evaluateRectifier("fullWave", 12, 50);
    const smooth = evaluateRectifier("smoothed", 12, 50);

    expect(half.activeDiodes).toBe(1);
    expect(full.activeDiodes).toBe(2);
    expect(full.dcAverage).toBeGreaterThan(half.dcAverage);
    expect(smooth.dcAverage).toBeGreaterThan(full.dcAverage);
    expect(smooth.ripplePercent).toBeLessThan(full.ripplePercent);
  });

  it("samples waveforms with default and minimum step bounds", () => {
    expect(sampleRectifierWave("fullWave")).toHaveLength(49);
    expect(sampleRectifierWave("halfWave", 2)).toHaveLength(9);
  });
});
