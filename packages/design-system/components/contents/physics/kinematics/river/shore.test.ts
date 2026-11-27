import { describe, expect, it } from "@effect/vitest";
import {
  bankHeight,
  bankSheet,
  reedBeds,
  reedClump,
  SHORE_EXTENT,
  shoreAt,
} from "@repo/design-system/components/contents/physics/kinematics/river/shore";
import { Array as Arr } from "effect";

describe("shoreAt", () => {
  it("lets each waterline wander a few metres, each bank its own way", () => {
    const places = Arr.makeBy(60, (index) => index * 7 - 200);
    expect(
      Math.max(...Arr.map(places, (along) => Math.abs(shoreAt(along, 1))))
    ).toBeLessThanOrEqual(3);
    expect(shoreAt(40, 1)).not.toBe(shoreAt(40, -1));
  });
});

describe("bankHeight", () => {
  it("meets the water exactly at the waterline", () => {
    expect(bankHeight(0, 12)).toBe(0);
    expect(bankHeight(0, -230)).toBe(0);
  });

  it("falls away under the water and climbs to a rolling meadow", () => {
    expect(bankHeight(-4, 5)).toBeCloseTo(-1.25, 9);
    expect(bankHeight(-9, 5)).toBeCloseTo(-1.25, 9);
    expect(bankHeight(40, 5)).toBeGreaterThan(1);
    expect(bankHeight(40, 5)).toBeLessThan(2.5);
  });
});

describe("bankSheet", () => {
  it("lays a bank from its waterline back, along the whole river", () => {
    const sheet = bankSheet(1, 30, [0, 2], 0);
    const count = sheet.positions.length / 3;
    expect(sheet.positions[0]).toBeCloseTo(-SHORE_EXTENT, 9);
    expect(sheet.positions[1]).toBeCloseTo(0, 9);
    expect(sheet.positions[2]).toBeCloseTo(30 + shoreAt(-SHORE_EXTENT, 1), 9);
    expect(sheet.positions[(count - 1) * 3]).toBeCloseTo(SHORE_EXTENT, 9);
    expect(sheet.uvs.length).toBe(count * 2);
    expect(sheet.indices.length % 3).toBe(0);
    expect(Math.max(...sheet.indices)).toBe(count - 1);
  });

  it("mirrors the far bank and winds it the other way, so both face up", () => {
    const near = bankSheet(1, 30, [0, 2], 0);
    const far = bankSheet(-1, 30, [0, 2], 0);
    expect(far.positions[2]).toBeLessThan(-26);
    expect(Arr.take(near.indices, 3)).toStrictEqual([0, 1, 2]);
    expect(Arr.take(far.indices, 3)).toStrictEqual([0, 2, 1]);
  });

  it("sinks a lifted layer's first edge and stands the rest over the bank", () => {
    const turf = bankSheet(1, 30, [1.7, 2.2], 0.07);
    expect(turf.positions[1]).toBeCloseTo(
      bankHeight(1.7, -SHORE_EXTENT) - 0.07,
      9
    );
    expect(turf.positions[4]).toBeCloseTo(
      bankHeight(2.2, -SHORE_EXTENT) + 0.07,
      9
    );
  });

  it("has nothing to lay without a distance behind the waterline", () => {
    expect(bankSheet(1, 30, [], 0.07).positions).toStrictEqual([]);
  });
});

describe("reedClump", () => {
  it("roots nine blades at the water and tapers each to its tip", () => {
    const clump = reedClump();
    const count = clump.positions.length / 3;
    expect(count).toBe(9 * 7 * 2);
    expect(clump.ups[0]).toBe(0);
    expect(clump.ups[13]).toBe(1);
    expect(clump.positions[1]).toBe(0);
    expect(clump.positions[13 * 3 + 1]).toBeGreaterThan(1.39);
    expect(clump.positions[13 * 3 + 1]).toBeLessThanOrEqual(2.4);
    expect(Math.max(...clump.indices)).toBe(count - 1);
  });
});

describe("reedBeds", () => {
  it("stands reeds in stretches of the shallows on both banks and leaves others bare", () => {
    const near = reedBeds(1, 30, 400);
    const far = reedBeds(-1, 30, 400);
    expect(near.length).toBeGreaterThan(20);
    expect(near.length).toBeLessThan(400);
    expect(far.length).toBeGreaterThan(20);
    expect(Math.max(...Arr.map(near, (bed) => bed.y))).toBeLessThanOrEqual(
      -0.05
    );
    expect(Math.min(...Arr.map(near, (bed) => bed.z))).toBeGreaterThan(25);
    expect(Math.max(...Arr.map(far, (bed) => bed.z))).toBeLessThan(-25);
  });
});
