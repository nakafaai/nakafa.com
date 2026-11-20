// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  meetingTex,
  momentTex,
  placeTex,
  rateTex,
  unitTex,
} from "@repo/design-system/components/contents/mathematics/journey/readout";

const UNITS = { distance: "km", speed: "km/j", time: "minit" } as const;

/** Writes numbers as the Malay locale does: a decimal comma, at most `digits` decimals. */
function quantity(value: number, unit: string, digits = 1) {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return `${String(rounded).replace(".", "{,}")}${unit}`;
}

describe("the readouts of the journey", () => {
  it("sets the lesson's units as text, its special characters written as themselves", () => {
    expect(unitTex("km/j")).toBe("\\text{ km/j}");
    expect(unitTex("km_{h}^~\\#")).toBe(
      "\\text{ km\\_\\{h\\}\\textasciicircum{}\\textasciitilde{}\\textbackslash{}\\#}"
    );
  });

  it("writes a moment, a distance and a meeting, and says when a readout rounds", () => {
    expect(momentTex(25, UNITS, quantity)).toBe("t = 25\\text{ minit}");
    expect(placeTex(12.5, UNITS, quantity)).toBe("d = 12{,}5\\text{ km}");
    expect(meetingTex({ distance: 12, minute: 80 / 3 }, UNITS, quantity)).toBe(
      "t \\approx 26{,}7\\text{ minit},\\; d = 12\\text{ km}"
    );
  });

  it("works a speed out as distance over time, or leaves it as a question", () => {
    const leg = { distance: 12, minutes: 15, speed: 48 };
    expect(rateTex(leg, UNITS, quantity, true)).toBe(
      "\\dfrac{12\\text{ km}}{15\\text{ minit}} = 48\\text{ km/j}"
    );
    expect(rateTex(leg, UNITS, quantity, false)).toBe(
      "\\dfrac{12\\text{ km}}{15\\text{ minit}} = \\;?"
    );
    expect(
      rateTex(
        { distance: 40, minutes: 90, speed: 80 / 3 },
        UNITS,
        quantity,
        true
      )
    ).toBe(
      "\\dfrac{40\\text{ km}}{90\\text{ minit}} \\approx 26{,}7\\text{ km/j}"
    );
  });
});
