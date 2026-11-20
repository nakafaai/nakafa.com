// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  JAR,
  jarSlots,
  LAYER_SIZE,
  MARBLE_RADIUS,
  mixedSlots,
  pileTop,
} from "@repo/design-system/components/contents/mathematics/marble/jar";
import { Array as Arr, Order } from "effect";

describe("marbles in the jar", () => {
  it("never lets two marbles overlap or a marble pass through the wall", () => {
    const slots = jarSlots(24);
    expect(slots).toHaveLength(24);
    Arr.forEach(slots, (slot, index) => {
      expect(Math.hypot(slot.x, slot.z)).toBeLessThanOrEqual(
        JAR.innerRadius - MARBLE_RADIUS
      );
      expect(slot.y).toBeGreaterThanOrEqual(JAR.floor + MARBLE_RADIUS);
      Arr.forEach(Arr.drop(slots, index + 1), (other) => {
        expect(
          Math.hypot(slot.x - other.x, slot.y - other.y, slot.z - other.z)
        ).toBeGreaterThanOrEqual(2 * MARBLE_RADIUS - 1e-9);
      });
    });
  });

  it("fills a layer before it starts the next", () => {
    const slots = jarSlots(LAYER_SIZE + 1);
    expect(Arr.getUnsafe(slots, LAYER_SIZE - 1).y).toBeCloseTo(
      JAR.floor + MARBLE_RADIUS
    );
    expect(Arr.getUnsafe(slots, LAYER_SIZE).y).toBeCloseTo(
      JAR.floor + 3 * MARBLE_RADIUS
    );
    expect(jarSlots(0)).toEqual([]);
  });

  it("mixes the marbles in a fixed order that uses every slot once", () => {
    const order = mixedSlots(20, 5);
    expect(mixedSlots(20, 5)).toEqual(order);
    expect(Arr.sort(order, Order.Number)).toEqual(
      Arr.makeBy(20, (index) => index)
    );
    expect(order).not.toEqual(Arr.makeBy(20, (index) => index));
    expect(mixedSlots(1, 5)).toEqual([0]);
  });

  it("finds the top of the pile, or the floor of an empty jar", () => {
    expect(pileTop(jarSlots(3))).toBeCloseTo(JAR.floor + 2 * MARBLE_RADIUS);
    expect(pileTop([])).toBe(JAR.floor);
  });
});
