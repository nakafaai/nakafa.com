// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  binaryMath,
  clampCount,
  digitsOf,
  groupBase,
  groupedMath,
  groupsOf,
  inBase,
  lampCount,
  largestCount,
  nextCount,
  paddedSlots,
  placeValues,
  slotCount,
} from "@repo/design-system/components/contents/mathematics/binary/bits";

describe("a number as a row of lamps", () => {
  it("keeps the row between four and eight lamps", () => {
    expect(lampCount(2)).toBe(4);
    expect(lampCount(6.4)).toBe(6);
    expect(lampCount(12)).toBe(8);
    expect(largestCount(6)).toBe(63);
  });

  it("shows only whole numbers the row can hold", () => {
    expect(clampCount(-3, 6)).toBe(0);
    expect(clampCount(44.6, 6)).toBe(45);
    expect(clampCount(500, 6)).toBe(63);
  });

  it("counts up and rolls over after every lamp is on", () => {
    expect(nextCount(44, 6)).toBe(45);
    expect(nextCount(63, 6)).toBe(0);
  });

  it("gives each lamp a power of two, the largest on the left", () => {
    expect(placeValues(6)).toEqual([32, 16, 8, 4, 2, 1]);
    expect(placeValues(8)[0]).toBe(128);
  });

  it("lights the lamps of the number's base two digits", () => {
    expect(digitsOf(45, 6)).toEqual([1, 0, 1, 1, 0, 1]);
    expect(digitsOf(0, 4)).toEqual([0, 0, 0, 0]);
    expect(binaryMath(45, 6)).toBe("101101_{2}");
    expect(binaryMath(0, 4)).toBe("0_{2}");
  });
});

describe("grouping the bits", () => {
  it("reads base four in pairs and base eight in threes", () => {
    expect(groupBase("none")).toBe(2);
    expect(groupBase("pairs")).toBe(4);
    expect(groupBase("triples")).toBe(8);
  });

  it("keeps a slot for every place that pairs or threes may pad", () => {
    expect(slotCount(4)).toBe(6);
    expect(slotCount(6)).toBe(6);
    expect(slotCount(7)).toBe(9);
    expect(slotCount(8)).toBe(9);
  });

  it("splits 101101 into the base eight digits 5 and 5", () => {
    expect(groupsOf(45, 6, "triples")).toEqual([
      { digit: 5, first: 0, last: 2 },
      { digit: 5, first: 3, last: 5 },
    ]);
    expect(groupedMath(45, 6, "triples")).toBe("55_{8}");
  });

  it("splits 101101 into the base four digits 2, 3 and 1", () => {
    expect(groupsOf(45, 6, "pairs")).toEqual([
      { digit: 2, first: 0, last: 1 },
      { digit: 3, first: 2, last: 3 },
      { digit: 1, first: 4, last: 5 },
    ]);
    expect(groupedMath(45, 6, "pairs")).toBe("231_{4}");
  });

  it("pads a short row with zeros on the left, in slots that hold no lamp", () => {
    expect(groupsOf(200, 8, "triples")).toEqual([
      { digit: 3, first: 0, last: 2 },
      { digit: 1, first: 3, last: 5 },
      { digit: 0, first: 6, last: 8 },
    ]);
    expect(paddedSlots(8, "triples")).toEqual([0]);
    expect(paddedSlots(8, "pairs")).toEqual([]);
    expect(paddedSlots(4, "triples")).toEqual([0, 1]);
    expect(paddedSlots(4, "none")).toEqual([]);
  });

  it("reads the row bit by bit as one group per lamp", () => {
    expect(groupsOf(5, 4, "none")).toEqual([
      { digit: 0, first: 2, last: 2 },
      { digit: 1, first: 3, last: 3 },
      { digit: 0, first: 4, last: 4 },
      { digit: 1, first: 5, last: 5 },
    ]);
  });

  it("writes a row read bit by bit as the sum of the place values that are on", () => {
    expect(groupedMath(45, 6, "none")).toBe("32 + 8 + 4 + 1");
    expect(groupedMath(0, 6, "none")).toBe("0");
  });

  it("writes any number in a base with the base as a subscript", () => {
    expect(inBase(255, 8)).toBe("377_{8}");
    expect(inBase(-2, 4)).toBe("0_{4}");
  });
});
