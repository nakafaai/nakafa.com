import { describe, expect, it } from "@effect/vitest";
import { ruleSheet } from "@repo/design-system/components/contents/physics/mechanics/springs/scale";
import { Array as Arr } from "effect";

describe("ruleSheet", () => {
  const format = (value: number, digits: number) => value.toFixed(digits);

  it("marks every centimetre of a 30 cm rule and numbers every fifth, zero at the top", () => {
    const sheet = ruleSheet({ long: 3, unit: 0.1, wide: 0.2 }, "black", format);
    const ticks = Arr.filter(sheet.marks, (mark) => mark.kind === "line");
    const numbers = Arr.filter(sheet.marks, (mark) => mark.kind === "text");
    expect(ticks).toHaveLength(31);
    expect(
      Arr.map(numbers, (mark) => mark.kind === "text" && mark.text)
    ).toEqual(["0", "5", "10", "15", "20", "25", "30"]);
    expect(ticks[0]?.kind === "line" && ticks[0].from).toEqual([0.1, 1.5]);
    expect(sheet.height).toBe(3);
    expect(sheet.width).toBe(0.2);
  });
});
