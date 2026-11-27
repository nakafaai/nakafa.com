// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BOARD,
  HALF,
  LAND,
  laneX,
  ROAD,
  roadZ,
  treeSpots,
  viewOf,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import { Array as Arr } from "effect";

describe("the road on the diorama", () => {
  it("runs from the start at one end to the farthest place at the other", () => {
    expect(roadZ(20, 0)).toBeCloseTo(ROAD.length / 2);
    expect(roadZ(20, 20)).toBeCloseTo(-ROAD.length / 2);
    expect(roadZ(20, 10)).toBeCloseTo(0);
    expect(HALF).toBeCloseTo(ROAD.length / 2 + ROAD.runOn);
  });

  it("keeps traffic to the left, and moves a vehicle over as it turns round", () => {
    expect(laneX(0)).toBeCloseTo(-BOARD.lane);
    expect(laneX(1)).toBeCloseTo(BOARD.lane);
    expect(laneX(0.5)).toBeCloseTo(0);
    expect(BOARD.lane * 2).toBeLessThan(BOARD.asphalt);
  });

  it("plants trees along the verge but never at a bus stop", () => {
    const open = treeSpots(-0.4, 0.4, []);
    const kept = treeSpots(-0.4, 0.4, [Arr.getUnsafe(open, 2)]);
    expect(open.length).toBe(9);
    expect(kept.length).toBe(open.length - 1);
    expect(Arr.every(open, (z) => z > -0.4 && z < 0.4)).toBe(true);
  });

  it("stands the camera back until the whole road fits a wide card", () => {
    const view = viewOf({ aspect: 16 / 9, fov: 30 }, 0.6);
    const slope = Math.tan((30 * Math.PI) / 360);
    expect(view.target).toBeCloseTo((LAND.front - LAND.back) / 2);
    expect(view.distance * slope * (16 / 9)).toBeGreaterThan(HALF);
  });

  it("stands farther back on a narrow card, which sees no wider than a square", () => {
    const wide = viewOf({ aspect: 16 / 9, fov: 30 }, 0.6);
    const square = viewOf({ aspect: 1, fov: 30 }, 0.6);
    const tall = viewOf({ aspect: 0.6, fov: 30 }, 0.6);
    expect(square.distance).toBeGreaterThan(wide.distance);
    expect(tall.distance).toBeCloseTo(square.distance);
  });

  it("fits the land's depth when the camera looks almost straight down on a very wide card", () => {
    const view = viewOf({ aspect: 6, fov: 30 }, 1.5);
    const deep = (LAND.back + LAND.front) / 2;
    const slope = Math.tan((30 * Math.PI) / 360);
    expect(view.distance).toBeCloseTo(((deep * Math.sin(1.5)) / slope) * 1.08);
  });
});
