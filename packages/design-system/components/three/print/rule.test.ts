// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  ruleAt,
  ruleMarks,
} from "@repo/design-system/components/three/print/rule";
import { Array as Arr } from "effect";

const plain = (value: number, digits: number) => value.toFixed(digits);

/** The side of a beaker: 100 to 400 mL read upwards, ticks to the right. */
const BEAKER = {
  from: [-0.01, -0.03],
  scale: { from: 100, major: 100, minor: 50, to: 400 },
  side: -1,
  to: [-0.01, 0.03],
} as const;

const STYLE = {
  ink: "ink",
  major: 0.01,
  minor: 0.005,
  size: 0.004,
  width: 0.0005,
};

describe("where a straight scale reads a value", () => {
  it("lies in proportion between its two ends, and stops at them", () => {
    expect(ruleAt(BEAKER, 250)).toEqual([-0.01, 0]);
    expect(ruleAt(BEAKER, 100)).toEqual([-0.01, -0.03]);
    expect(ruleAt(BEAKER, 999)).toEqual([-0.01, 0.03]);
  });
});

describe("the printed ticks of a straight scale", () => {
  it("draws each tick square to the scale at the height of its value", () => {
    const lines = Arr.filter(
      ruleMarks(BEAKER, plain, STYLE),
      (mark) => mark.kind === "line"
    );
    const heights = [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03];
    expect(lines).toHaveLength(heights.length);
    Arr.forEach(heights, (height, index) => {
      expect(lines[index]?.from[1]).toBeCloseTo(height);
    });
    expect(lines[0]?.to[0]).toBeCloseTo(0);
    expect(lines[1]?.to[0]).toBeCloseTo(-0.005);
    expect(lines[0]?.to[1]).toBeCloseTo(-0.03);
  });

  it("starts each number past the end of its tick, on the side the ticks grow to", () => {
    const numbers = Arr.filter(
      ruleMarks(BEAKER, plain, STYLE),
      (mark) => mark.kind === "text"
    );
    expect(Arr.map(numbers, (mark) => mark.text)).toEqual([
      "100",
      "200",
      "300",
      "400",
    ]);
    expect(numbers[0]?.align).toBe("start");
    expect(numbers[0]?.at[0]).toBeCloseTo(0.01 - 0.01 + 0.004 * 0.45);
  });

  it("ends each number at its tick when the ticks grow to the left", () => {
    const numbers = Arr.filter(
      ruleMarks({ ...BEAKER, side: 1 }, plain, STYLE),
      (mark) => mark.kind === "text"
    );
    expect(numbers[0]?.align).toBe("end");
    expect(numbers[0]?.at[0]).toBeLessThan(-0.02);
  });

  it("centres each number over its tick on a scale that runs across", () => {
    const numbers = Arr.filter(
      ruleMarks(
        {
          from: [-0.05, 0],
          scale: { from: 0, major: 5, to: 10 },
          side: 1,
          to: [0.05, 0],
        },
        plain,
        STYLE
      ),
      (mark) => mark.kind === "text"
    );
    expect(Arr.map(numbers, (mark) => mark.align)).toEqual([
      "middle",
      "middle",
      "middle",
    ]);
    expect(numbers[1]?.at[0]).toBeCloseTo(0);
    expect(numbers[1]?.at[1]).toBeCloseTo(0.01 + 0.004 * 0.95);
  });

  it("turns the numbers of a ruler that lies across the view, centred over their ticks", () => {
    const numbers = Arr.filter(
      ruleMarks(BEAKER, plain, { ...STYLE, turn: -Math.PI / 2 }),
      (mark) => mark.kind === "text"
    );
    expect(numbers[0]?.turn).toBe(-Math.PI / 2);
    expect(numbers[0]?.align).toBe("middle");
  });

  it("prints no numbers at a size of 0", () => {
    const marks = ruleMarks(BEAKER, plain, { ...STYLE, size: 0 });
    expect(Arr.every(marks, (mark) => mark.kind === "line")).toBe(true);
  });

  it("draws ticks of no length for a scale whose two ends are one place", () => {
    const marks = ruleMarks({ ...BEAKER, to: BEAKER.from }, plain, {
      ...STYLE,
      size: 0,
    });
    expect(marks[0]).toMatchObject({
      from: [-0.01, -0.03],
      to: [-0.01, -0.03],
    });
  });
});
