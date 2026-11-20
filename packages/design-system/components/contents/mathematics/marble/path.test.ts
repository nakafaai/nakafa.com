// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  JAR,
  MARBLE_RADIUS,
} from "@repo/design-system/components/contents/mathematics/marble/jar";
import {
  along,
  DISH_AT,
  firstPlace,
  HELD,
  JAR_AT,
  secondPlace,
  slotAt,
  surfaceAt,
} from "@repo/design-system/components/contents/mathematics/marble/path";
import { STEPS } from "@repo/design-system/components/contents/mathematics/marble/run";
import { Vector3 } from "three";

const SLOT = { x: 0.01, y: JAR.floor + MARBLE_RADIUS, z: -0.01 };
const START = surfaceAt(SLOT, 0.05);
const REST = slotAt(SLOT);
const ON_DISH = DISH_AT.clone().setY(DISH_AT.y + MARBLE_RADIUS);

describe("a drawn marble's path", () => {
  it("places slots in the jar and the surface of the pile above them", () => {
    expect(REST.toArray()).toEqual([
      JAR_AT.x + 0.01,
      JAR.floor + MARBLE_RADIUS,
      JAR_AT.z - 0.01,
    ]);
    expect(START.y).toBeCloseTo(0.05 + MARBLE_RADIUS);
  });

  it("lifts a path by its arc at the middle and keeps its ends", () => {
    const from = new Vector3(0, 0, 0);
    const to = new Vector3(1, 0, 0);
    expect(along(from, to, 0.5, 0.2).y).toBeCloseTo(0.2);
    expect(along(from, to, 1, 0.2).toArray()).toEqual([1, 0, 0]);
  });

  it("holds the first marble above the jar, then returns it with replacement", () => {
    expect(firstPlace(0, "replace", START, REST).distanceTo(START)).toBe(0);
    expect(firstPlace(STEPS.firstHeld + 0.1, "replace", START, REST)).toEqual(
      HELD
    );
    expect(firstPlace(STEPS.firstPlaced, "replace", START, REST)).toBe(REST);
    expect(
      firstPlace(
        (STEPS.firstRead + STEPS.firstPlaced) / 2,
        "replace",
        START,
        REST
      ).y
    ).toBeLessThan(HELD.y);
  });

  it("keeps the first marble on the dish without replacement, until the trial ends", () => {
    expect(
      firstPlace(STEPS.firstPlaced, "keep", START, REST).distanceTo(ON_DISH)
    ).toBeCloseTo(0);
    expect(
      firstPlace((STEPS.firstRead + STEPS.firstPlaced) / 2, "keep", START, REST)
        .y
    ).toBeGreaterThan(ON_DISH.y);
    expect(
      firstPlace(STEPS.returned, "keep", START, REST).distanceTo(START)
    ).toBeCloseTo(0);
  });

  it("draws the second marble after the first is placed, and returns it", () => {
    expect(secondPlace(0, START, REST)).toBe(REST);
    expect(
      secondPlace(STEPS.firstPlaced, START, REST).distanceTo(START)
    ).toBeCloseTo(0);
    expect(secondPlace(STEPS.secondHeld, START, REST)).toEqual(HELD);
    expect(
      secondPlace(STEPS.returned, START, REST).distanceTo(START)
    ).toBeCloseTo(0);
  });
});
