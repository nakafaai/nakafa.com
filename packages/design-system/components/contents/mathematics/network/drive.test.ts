// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  COUNT_STEP,
  countedAt,
  driveAt,
  driveSchedule,
  pathLength,
  pointAlong,
  VAN_REST,
  VAN_SPEED,
} from "@repo/design-system/components/contents/mathematics/network/drive";
import { Option } from "effect";

const line = [
  { x: 0, z: 0 },
  { x: 0.3, z: 0 },
  { x: 0.3, z: 0.4 },
];

describe("van drive", () => {
  it("measures a line through its points", () => {
    expect(pathLength(line)).toBeCloseTo(0.7);
    expect(pathLength([{ x: 1, z: 1 }])).toBe(0);
  });

  it("places the van along the line, facing along its stretch", () => {
    expect(pointAlong(line, 0.15)).toEqual({ heading: -0, x: 0.15, z: 0 });
    const turned = pointAlong(line, 0.5);
    expect(turned.x).toBeCloseTo(0.3);
    expect(turned.z).toBeCloseTo(0.2);
    expect(turned.heading).toBeCloseTo(-Math.PI / 2);
  });

  it("waits at the ends before and after the line", () => {
    expect(pointAlong(line, -1)).toEqual({ heading: -0, x: 0, z: 0 });
    const past = pointAlong(line, 5);
    expect(past.x).toBeCloseTo(0.3);
    expect(past.z).toBeCloseTo(0.4);
    expect(pointAlong([{ x: 1, z: 2 }], 1)).toEqual({ heading: 0, x: 1, z: 2 });
  });

  it("runs the drives one after another with a rest after each", () => {
    const { drives, total } = driveSchedule([0.32, 0.16]);
    expect(drives[0]).toEqual({
      end: 0.32 / VAN_SPEED,
      length: 0.32,
      start: 0,
    });
    expect(drives[1]?.start).toBeCloseTo(0.32 / VAN_SPEED + VAN_REST);
    expect(total).toBeCloseTo(0.48 / VAN_SPEED + 2 * VAN_REST);
    expect(driveSchedule([])).toEqual({ drives: [], total: 0 });
  });

  it("knows which drive is under way and how far it has gone", () => {
    const { drives } = driveSchedule([0.32, 0.16]);
    expect(driveAt(drives, -1)).toEqual({ distance: 0, index: 0 });
    expect(driveAt(drives, 1).distance).toBeCloseTo(VAN_SPEED);
    expect(driveAt(drives, 2.5)).toEqual({ distance: 0.32, index: 0 });
    expect(driveAt(drives, 100)).toEqual({ distance: 0.16, index: 1 });
  });

  it("counts the towns one step each, then none", () => {
    const towns = [
      { id: "A", name: "Alor" },
      { id: "B", name: "Bukit" },
    ];
    expect(countedAt(towns, 0)).toEqual(Option.some("A"));
    expect(countedAt(towns, COUNT_STEP * 1.5)).toEqual(Option.some("B"));
    expect(countedAt(towns, COUNT_STEP * 2)).toEqual(Option.none());
  });
});
