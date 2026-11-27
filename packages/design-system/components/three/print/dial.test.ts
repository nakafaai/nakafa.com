// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  dialAngle,
  dialMarks,
} from "@repo/design-system/components/three/print/dial";
import { Array as Arr } from "effect";

/** A pressure gauge: 0 to 300 kPa over three quarters of a turn, its gap at the foot. */
const GAUGE = {
  centre: [0.01, -0.02],
  radius: 0.04,
  scale: { from: 0, major: 50, minor: 10, to: 300 },
  sweep: { from: (Math.PI * 5) / 4, to: -Math.PI / 4 },
} as const;

const plain = (value: number, digits: number) => value.toFixed(digits);

describe("the angle a dial shows a value at", () => {
  it("runs from the sweep's first angle to its last", () => {
    expect(dialAngle(GAUGE, 0)).toBeCloseTo((Math.PI * 5) / 4);
    expect(dialAngle(GAUGE, 150)).toBeCloseTo(Math.PI / 2);
    expect(dialAngle(GAUGE, 300)).toBeCloseTo(-Math.PI / 4);
  });

  it("stops the needle at the ends of the scale", () => {
    expect(dialAngle(GAUGE, -40)).toBeCloseTo((Math.PI * 5) / 4);
    expect(dialAngle(GAUGE, 900)).toBeCloseTo(-Math.PI / 4);
  });
});

describe("the printed scale of a dial", () => {
  const marks = dialMarks(GAUGE, plain, { ink: "ink", numbered: true });
  const lines = Arr.filter(marks, (mark) => mark.kind === "line");
  const numbers = Arr.filter(marks, (mark) => mark.kind === "text");

  it("draws a tick at every step and a number at every numbered one", () => {
    expect(lines).toHaveLength(31);
    expect(Arr.map(numbers, (mark) => mark.text)).toEqual([
      "0",
      "50",
      "100",
      "150",
      "200",
      "250",
      "300",
    ]);
  });

  it("ends every tick on the dial's radius, pointing at the pivot", () => {
    for (const line of lines) {
      const out = Math.hypot(line.to[0] - 0.01, line.to[1] + 0.02);
      const inner = Math.hypot(line.from[0] - 0.01, line.from[1] + 0.02);
      expect(out).toBeCloseTo(0.04);
      expect(inner).toBeLessThan(out);
    }
  });

  it("stands the tick of 150 kPa straight above the pivot, longer than a short one", () => {
    const middle = lines[15];
    const short = lines[14];
    expect(middle?.to[0]).toBeCloseTo(0.01);
    expect(middle?.to[1]).toBeCloseTo(0.02);
    expect((middle?.width ?? 0) > (short?.width ?? 0)).toBe(true);
  });

  it("sets each number upright inside its tick", () => {
    const zero = numbers[0];
    expect(zero?.turn).toBe(0);
    expect(
      Math.hypot((zero?.at[0] ?? 0) - 0.01, (zero?.at[1] ?? 0) + 0.02)
    ).toBeCloseTo(0.04 * 0.56);
  });

  it("prints ticks alone on a dial that names no number", () => {
    const bare = dialMarks(GAUGE, plain, { ink: "ink", numbered: false });
    expect(bare).toHaveLength(31);
    expect(Arr.every(bare, (mark) => mark.kind === "line")).toBe(true);
  });
});
