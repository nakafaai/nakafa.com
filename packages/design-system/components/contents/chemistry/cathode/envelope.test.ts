import { describe, expect, it } from "@effect/vitest";
import {
  ENVELOPE,
  envelopeOutline,
  envelopeRadius,
} from "@repo/design-system/components/contents/chemistry/cathode/envelope";
import { Array as Arr } from "effect";

describe("cathode-ray tube envelope", () => {
  it("closes at both ends and holds the neck and the bulb at their radii", () => {
    expect(envelopeRadius(ENVELOPE.end)).toBe(0);
    expect(envelopeRadius(ENVELOPE.apex)).toBe(0);
    expect(envelopeRadius(0)).toBe(ENVELOPE.neck);
    expect(envelopeRadius(ENVELOPE.shoulder)).toBeCloseTo(ENVELOPE.bulb, 9);
  });

  it("widens without a step from the neck to the bulb", () => {
    const flare = Arr.map(Arr.range(0, 50), (step) =>
      envelopeRadius(
        ENVELOPE.flare + ((ENVELOPE.shoulder - ENVELOPE.flare) * step) / 50
      )
    );
    const steps = Arr.map(
      Arr.zip(flare, Arr.drop(flare, 1)),
      ([a, b]) => b - a
    );
    expect(Arr.every(steps, (step) => step >= 0 && step < 0.1)).toBe(true);
  });

  it("outlines the envelope from the cathode end to the apex", () => {
    const outline = envelopeOutline(100);
    expect(outline).toHaveLength(101);
    expect(outline[0]).toEqual([0, ENVELOPE.end]);
    expect(outline[100]?.[1]).toBeCloseTo(ENVELOPE.apex, 9);
  });
});
