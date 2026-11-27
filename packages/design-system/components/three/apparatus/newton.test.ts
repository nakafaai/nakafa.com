import { describe, expect, it } from "@effect/vitest";
import {
  meterReach,
  NEWTON_METER,
  newtonSheet,
  stretch,
} from "@repo/design-system/components/three/apparatus/newton";
import { Array as Arr } from "effect";

describe("stretch", () => {
  it("stretches in proportion to the force, as Hooke's law says", () => {
    expect(stretch(10, 40, 0.4)).toBeCloseTo(0.1, 12);
    expect(stretch(30, 40, 0.4)).toBeCloseTo(0.3, 12);
  });

  it("stops at the end of the scale and never reads below zero", () => {
    expect(stretch(55, 40, 0.4)).toBe(0.4);
    expect(stretch(-3, 40, 0.4)).toBe(0);
  });
});

describe("meterReach", () => {
  it("draws the ring away from the hook by the stretch of the spring", () => {
    expect(meterReach(40, 40) - meterReach(0, 40)).toBeCloseTo(
      NEWTON_METER.travel,
      12
    );
    expect(meterReach(20, 40) - meterReach(0, 40)).toBeCloseTo(
      NEWTON_METER.travel / 2,
      12
    );
  });
});

describe("newtonSheet", () => {
  const format = (value: number, digits: number) => value.toFixed(digits);
  const sheet = newtonSheet(
    { most: 40, travel: 0.4, wide: 0.1 },
    "black",
    format
  );

  it("numbers a 40 N meter in four steps of 10 N with five ticks to each", () => {
    expect(
      Arr.filter(sheet.marks, (mark) => mark.kind === "line")
    ).toHaveLength(21);
    expect(
      Arr.map(
        Arr.filter(sheet.marks, (mark) => mark.kind === "text"),
        (mark) => mark.kind === "text" && mark.text
      )
    ).toStrictEqual(["0", "10", "20", "30", "40", "N"]);
  });

  it("spreads the scale evenly over the travel of the spring from zero", () => {
    const ticks = Arr.filter(sheet.marks, (mark) => mark.kind === "line");
    expect(ticks[0]?.kind === "line" && ticks[0].from[1]).toBeCloseTo(-0.2, 12);
    expect(ticks[10]?.kind === "line" && ticks[10].from[1]).toBeCloseTo(0, 12);
    expect(ticks[20]?.kind === "line" && ticks[20].from[1]).toBeCloseTo(
      0.2,
      12
    );
    expect(sheet.width).toBe(0.1);
    expect(sheet.height).toBeGreaterThan(0.4);
  });
});
