import { describe, expect, it } from "@effect/vitest";
import {
  type River,
  RiverSchema,
  riverCrossing,
} from "@repo/design-system/components/contents/physics/kinematics/river/crossing";
import { Schema } from "effect";

/** The heading upstream, in degrees, that cancels the drift, when the boat is faster than the current. */
function straightHeading(river: River) {
  return river.current < river.boatSpeed
    ? (-Math.asin(river.current / river.boatSpeed) * 180) / Math.PI
    : undefined;
}

const river = Schema.decodeSync(RiverSchema)({
  boatSpeed: 4,
  current: 3,
  width: 60,
});

describe("riverCrossing", () => {
  it("adds a 4 m/s crossing and a 3 m/s current into 5 m/s", () => {
    const crossing = riverCrossing(river, 0);
    expect(crossing?.speed).toBe(5);
    expect(crossing?.time).toBe(15);
    expect(crossing?.drift).toBe(45);
    expect(crossing?.angle).toBeCloseTo(36.87, 2);
  });

  it("lands straight across when heading upstream at asin(3/4)", () => {
    const heading = straightHeading(river) ?? 0;
    expect(heading).toBeCloseTo(-48.59, 2);
    const crossing = riverCrossing(river, heading);
    expect(crossing?.drift).toBeCloseTo(0);
    expect(crossing?.time).toBeCloseTo(60 / Math.sqrt(7), 5);
  });

  it("never crosses when heading along the bank", () => {
    expect(riverCrossing(river, 90)).toBeUndefined();
  });

  it("cannot cancel a current faster than the boat", () => {
    const flood = Schema.decodeSync(RiverSchema)({
      boatSpeed: 2,
      current: 3,
      width: 60,
    });
    expect(straightHeading(flood)).toBeUndefined();
  });

  it("refuses a river with no width", () => {
    expect(() =>
      Schema.decodeSync(RiverSchema)({
        boatSpeed: 2,
        current: 3,
        width: 0,
      })
    ).toThrow();
  });
});
