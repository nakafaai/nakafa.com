import { describe, expect, it } from "@effect/vitest";
import { plotSheet } from "@repo/design-system/components/contents/physics/measurement/stopwatch/plot";
import { Array as Arr } from "effect";

/** Writes a number with a decimal point. */
function plain(value: number, digits: number) {
  return value.toFixed(digits);
}

/** The dots of a sheet: its filled marks. */
function dotsOf(times: readonly number[], shown: number) {
  return Arr.flatMap(plotSheet(times, shown, plain).marks, (mark) =>
    mark.kind === "band" ? [mark] : []
  );
}

describe("stopwatch results sheet", () => {
  it("prints one dot for each shown reading and stacks the ones that repeat", () => {
    const dots = dotsOf([17.9, 17.9, 18], 3);

    expect(dots).toHaveLength(3);
    expect(dots[0]?.at[0]).toBeCloseTo(-16.8, 9);
    expect(dots[1]?.at[0]).toBeCloseTo(-16.8, 9);
    expect(dots[2]?.at[0]).toBeCloseTo(16.8, 9);
    expect((dots[1]?.at[1] ?? 0) - (dots[0]?.at[1] ?? 0)).toBeCloseTo(6.3, 9);
    expect(dots[2]?.at[1]).toBe(dots[0]?.at[1]);
  });

  it("holds the latest dot back until its trial is over, then marks it", () => {
    const landed = dotsOf([17.9, 18], 2);

    expect(dotsOf([17.9, 18], 1)).toHaveLength(1);
    expect(landed).toHaveLength(2);
    expect(landed[1]?.ink).not.toBe(landed[0]?.ink);
  });

  it("numbers the scale every tenth of a second and keeps every dot on the sheet", () => {
    const numbers = Arr.flatMap(
      plotSheet([17.2, 18.9], 2, plain).marks,
      (mark) => (mark.kind === "text" ? [mark.text] : [])
    );
    const outside = dotsOf([17.2, 18.9], 2);

    expect(numbers).toEqual(["17.7", "17.8", "17.9", "18.0", "18.1", "18.2"]);
    expect(outside[0]?.at[0]).toBe(-84);
    expect(outside[1]?.at[0]).toBe(84);
  });
});
