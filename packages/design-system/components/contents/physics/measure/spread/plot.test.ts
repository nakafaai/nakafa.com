import { describe, expect, it } from "@effect/vitest";
import { spreadSheet } from "@repo/design-system/components/contents/physics/measure/spread/plot";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";

/** Writes a number with a decimal point. */
function plain(value: number, digits: number) {
  return value.toFixed(digits);
}

const STUDENTS = [
  { name: "Ana", readings: [12.3, 12.5, 12.4, 12.4] },
  { name: "Budi", readings: [12.9, 13, 12.9, 13.1] },
  { name: "Cici", readings: [11.6, 12.9, 12.2, 13.3] },
] as const;

/** The marks of the sheet for the three students with one of them chosen. */
function marksOf(chosen: number) {
  return spreadSheet(STUDENTS, 12.4, chosen, "12.40 cm", plain).marks;
}

describe("spread results sheet", () => {
  it("gives every student a row and every reading a dot, stacked where readings repeat", () => {
    const sheet = spreadSheet(STUDENTS, 12.4, 0, "12.40 cm", plain);
    const dots = Arr.flatMap(sheet.marks, (mark) =>
      mark.kind === "band" ? [mark] : []
    );

    expect(sheet.height).toBe(20 + 3 * 26 + 20);
    expect(dots).toHaveLength(12);
    expect(dots[3]?.at[0]).toBe(dots[2]?.at[0]);
    expect((dots[3]?.at[1] ?? 0) - (dots[2]?.at[1] ?? 0)).toBeCloseTo(5.8, 9);
    expect(dots[1]?.at[1]).toBe(dots[0]?.at[1]);
  });

  it("centres the scale on the actual value and numbers it in whole steps", () => {
    const texts = Arr.flatMap(marksOf(0), (mark) =>
      mark.kind === "text" ? [mark] : []
    );

    expect(Arr.map(texts, (mark) => mark.text)).toEqual([
      "Ana",
      "Budi",
      "Cici",
      "12.40 cm",
      "12",
      "13",
    ]);
    expect(texts[3]?.at[0]).toBeCloseTo(17, 9);
  });

  it("numbers a narrow scale in finer steps", () => {
    const sheet = spreadSheet(
      [{ name: "Ana", readings: [10.064, 9.95] }],
      10,
      1,
      "10.00 cm",
      plain
    );
    const numbers = Arr.flatMap(sheet.marks, (mark) =>
      mark.kind === "text" && mark.size < 7 ? [mark.text] : []
    );

    expect(numbers).toEqual(["10.00 cm", "9.95", "10.00", "10.05"]);
  });

  it("picks out the chosen row in amber, with an arrow from the actual value to its mean", () => {
    const amber = (chosen: number) =>
      Arr.filter(marksOf(chosen), (mark) => mark.ink === PLOT_COLORS.amber);
    const pink = (marks: ReturnType<typeof marksOf>) =>
      Arr.flatMap(marks, (mark) =>
        mark.kind === "line" && mark.ink === PLOT_COLORS.pink ? [mark] : []
      );
    const high = pink(marksOf(1));
    const low = pink(
      spreadSheet(
        [{ name: "Dewi", readings: [9.8, 9.9] }],
        10,
        0,
        "10.00 cm",
        plain
      ).marks
    );

    expect(amber(1)).toHaveLength(5);
    expect(high).toHaveLength(3);
    expect(high[0]?.to[0]).toBeGreaterThan(high[0]?.from[0] ?? 0);
    expect(high[1]?.to[0]).toBeLessThan(high[1]?.from[0] ?? 0);
    expect(low[0]?.to[0]).toBeLessThan(low[0]?.from[0] ?? 0);
    expect(low[1]?.to[0]).toBeGreaterThan(low[1]?.from[0] ?? 0);
  });
});
