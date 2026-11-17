// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  cellsAcross,
  divisionsSpanned,
  divisionValue,
  FIELD_NUMBER,
  fieldAt,
  fieldDiameter,
  GRATICULE_SPAN,
  totalMagnification,
} from "@repo/design-system/components/contents/biology/microscope/optics";

describe("microscope optics", () => {
  it("multiplies the eyepiece by the objective", () => {
    expect(totalMagnification(10, 40)).toBe(400);
  });

  it("widens the field as the magnification falls", () => {
    const field = { diameter: 0.4, magnification: 400 };

    expect(fieldDiameter(field, 400)).toBe(0.4);
    expect(fieldDiameter(field, 100)).toBeCloseTo(1.6, 12);
    expect(cellsAcross(0.4, 50)).toBeCloseTo(8, 12);
    expect(cellsAcross(1.6, 50)).toBeCloseTo(32, 12);
  });

  it("calibrates the graticule and carries it to a stronger objective", () => {
    const graticule = { eyepiece: 40, micrometer: 10 };

    expect(divisionValue(graticule, 10, 10)).toBe(2.5);
    expect(divisionValue(graticule, 10, 40)).toBe(0.625);
    expect(divisionsSpanned(20, 0.625)).toBe(32);
  });

  it("reads the field from a measurement, a graticule, or the field number", () => {
    const objectives = [10, 40] as const;

    expect(
      fieldAt({
        eyepiece: 10,
        field: { diameter: 0.4, magnification: 400 },
        graticule: undefined,
        objective: 10,
        objectives,
      })
    ).toBeCloseTo(1.6, 12);
    expect(
      fieldAt({
        eyepiece: 10,
        field: undefined,
        graticule: { eyepiece: 40, micrometer: 10 },
        objective: 40,
        objectives,
      })
    ).toBeCloseTo((100 * 0.625) / GRATICULE_SPAN / 1000, 12);
    expect(
      fieldAt({
        eyepiece: 10,
        field: undefined,
        graticule: undefined,
        objective: 40,
        objectives,
      })
    ).toBe(FIELD_NUMBER / 40);
  });
});
