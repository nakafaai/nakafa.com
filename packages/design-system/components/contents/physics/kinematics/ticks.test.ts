import { describe, expect, it } from "@effect/vitest";
import {
  axisTicks,
  curvePoints,
  roomyLabels,
} from "@repo/design-system/components/contents/physics/kinematics/ticks";

describe("axisTicks", () => {
  it("steps by a round number from the start to the first tick past the end", () => {
    expect(axisTicks(0, 80)).toStrictEqual([0, 20, 40, 60, 80]);
    expect(axisTicks(0, 7)).toStrictEqual([0, 2, 4, 6, 8]);
    expect(axisTicks(-10, 10)).toStrictEqual([-10, -5, 0, 5, 10]);
    expect(axisTicks(-6, 6)).toStrictEqual([-10, -5, 0, 5, 10]);
    expect(axisTicks(3, 110)).toStrictEqual([0, 50, 100, 150]);
  });

  it("still gives an axis when the range is empty", () => {
    expect(axisTicks(3, 3).length).toBeGreaterThan(0);
    expect(axisTicks(3, 3)[0]).toBeCloseTo(3, 9);
  });
});

describe("curvePoints", () => {
  it("samples the quantity evenly from the first moment to the last", () => {
    expect(curvePoints(0, 4, 4, (time) => time * time)).toStrictEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 4 },
      { x: 3, y: 9 },
      { x: 4, y: 16 },
    ]);
  });
});

describe("roomyLabels", () => {
  it("keeps every label of a row with room between them", () => {
    expect(roomyLabels([0, 80, 160], 60)).toBe(0b111);
  });

  it("drops the labels that would touch the last one kept", () => {
    expect(roomyLabels([0, 20, 45, 70, 100, 131], 60)).toBe(0b10_1001);
  });

  it("gives no label to a post that is off the screen", () => {
    expect(roomyLabels([Number.NaN, 0, Number.NaN, 90], 60)).toBe(0b1010);
  });
});
