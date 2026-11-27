import { describe, expect, it } from "@effect/vitest";
import { plotSheet } from "@repo/design-system/components/contents/physics/measurement/stopwatch/plot";
import { Array as Arr } from "effect";

/** Writes a number with a decimal point. */
function plain(value: number, digits: number) {
  return value.toFixed(digits);
}

/** The dots of a sheet: its round bands. */
function dotsOf(times: readonly number[], shown: number) {
  return Arr.filter(
    plotSheet(times, shown, plain).marks,
    (mark) => mark.kind === "band"
  );
}

describe("stopwatch results sheet", () => {
  it("prints one dot for each shown reading and stacks the ones that repeat", () => {
    const dots = dotsOf([17.9, 17.9, 18], 3);

    expect(dots).toHaveLength(3);
    expect(
      Arr.map(dots, (dot) => (dot.kind === "band" ? dot.at[0] : 0))
    ).toEqual([
      expect.closeTo(-16.8, 5),
      expect.closeTo(-16.8, 5),
      expect.closeTo(16.8, 5),
    ]);
    expect(dots[1]?.kind === "band" && dots[1].at[1]).toBeCloseTo(
      (dots[0]?.kind === "band" ? dots[0].at[1] : 0) + 6.3
    );
  });

  it("holds the latest dot back until its trial is over, then marks it", () => {
    expect(dotsOf([17.9, 18], 1)).toHaveLength(1);
    expect(dotsOf([17.9, 18], 2)[1]?.ink).not.toBe(
      dotsOf([17.9, 18], 2)[0]?.ink
    );
  });

  it("numbers the scale every tenth of a second and keeps every mark on the sheet", () => {
    const sheet = plotSheet([17.2, 18.9], 2, plain);
    const numbers = Arr.filter(sheet.marks, (mark) => mark.kind === "text");

    expect(
      Arr.map(numbers, (mark) => (mark.kind === "text" ? mark.text : ""))
    ).toEqual(["17.7", "17.8", "17.9", "18.0", "18.1", "18.2"]);
    expect(
      Arr.map(dotsOf([17.2, 18.9], 2), (dot) =>
        dot.kind === "band" ? dot.at[0] : 0
      )
    ).toEqual([-84, 84]);
  });
});
