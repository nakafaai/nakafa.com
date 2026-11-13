// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  contactOf,
  finalGap,
  gapAt,
  initialGap,
  settleTime,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/gap";
import { Option } from "effect";

const twoSeconds = { deceleration: 5, headway: 2, reaction: 1.5, speed: 25 };

describe("following distance", () => {
  it("turns a time gap into road: v·h", () => {
    expect(initialGap(twoSeconds)).toBe(50);
  });

  it("only loses the road covered while the driver reacts", () => {
    expect(finalGap(twoSeconds)).toBeCloseTo(50 - 25 * 1.5, 9);
    expect(settleTime(twoSeconds)).toBe(1.5 + 5);
    expect(contactOf(twoSeconds)).toEqual(Option.none());
  });

  it("closes the gap by b·t²/2 while the rear driver still reacts", () => {
    expect(gapAt(twoSeconds, 1)).toBeCloseTo(50 - 2.5, 9);
  });

  it("crashes whenever the time gap is shorter than the reaction", () => {
    const close = { ...twoSeconds, headway: 1 };
    const contact = Option.getOrThrow(contactOf(close));
    expect(gapAt(close, contact.time)).toBeCloseTo(0, 6);
    // The gap runs out while both brake:
    // d0 − b·tr²/2 − b·tr·(t − tr) = 0, so 25 − 5.625 − 7.5(t − 1.5) = 0.
    expect(contact.time).toBeCloseTo(1.5 + 19.375 / 7.5, 6);
    expect(contact.closing).toBeCloseTo(5 * 1.5, 6);
  });

  it("crashes at the same time gap whatever the speed", () => {
    const slow = { ...twoSeconds, headway: 1.4, speed: 10 };
    const fast = { ...twoSeconds, headway: 1.4, speed: 30 };
    expect(Option.isSome(contactOf(slow))).toBe(true);
    expect(Option.isSome(contactOf(fast))).toBe(true);
  });
});
