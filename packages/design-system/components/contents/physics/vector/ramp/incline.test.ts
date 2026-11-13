import { describe, expect, it } from "@effect/vitest";
import {
  BlockSchema,
  rampForces,
  slopeWork,
} from "@repo/design-system/components/contents/physics/vector/ramp/incline";
import { Schema } from "effect";

const block = Schema.decodeSync(BlockSchema)({ friction: 0.5, mass: 2 });

describe("rampForces", () => {
  it("splits 19.6 N at 30° into 9.8 N down the slope and 16.97 N into it", () => {
    const forces = rampForces(block, 30);
    expect(forces.weight).toBeCloseTo(19.6, 10);
    expect(forces.along).toBeCloseTo(9.8, 10);
    expect(forces.into).toBeCloseTo(16.974, 3);
    expect(forces.normal).toBe(forces.into);
    expect(forces.along ** 2 + forces.into ** 2).toBeCloseTo(19.6 ** 2, 8);
  });

  it("holds at 26° and slips at 27° when tan θ passes 0.5", () => {
    expect(rampForces(block, 26).slips).toBe(false);
    expect(rampForces(block, 27).slips).toBe(true);
  });
});

describe("slopeWork", () => {
  it("does 19.6 J over 2 m at 30°, the weight times the drop of 1 m", () => {
    expect(slopeWork(block, 30, 2)).toBeCloseTo(19.6, 10);
  });

  it("does no work on a level bench", () => {
    expect(slopeWork(block, 0, 2)).toBeCloseTo(0, 10);
  });
});
