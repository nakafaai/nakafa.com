// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { DIE } from "@repo/design-system/components/contents/mathematics/dice/faces";
import type {
  Pose,
  Throw,
} from "@repo/design-system/components/contents/mathematics/dice/pose";
import {
  airborne,
  FELT,
  gatherPose,
  lowestPoint,
  restPose,
  TRAVEL,
  tumblePose,
} from "@repo/design-system/components/contents/mathematics/dice/pose";
import {
  axisAngle,
  IDENTITY,
  rotate,
} from "@repo/design-system/components/contents/mathematics/dice/turn";
import { Array as Arr } from "effect";

const SIX: Throw = { face: 6, lane: 0, rest: [0.03, 0.01], twist: 1, yaw: 0.4 };
const FOUR: Throw = {
  face: 4,
  lane: 0.024,
  rest: [0.01, 0.02],
  twist: -1,
  yaw: 2,
};

/** Expects two poses to agree to 9 places. */
function expectSamePose(actual: Pose, expected: Pose) {
  Arr.forEach(actual.position, (value, index) => {
    expect(value).toBeCloseTo(Arr.getUnsafe(expected.position, index), 9);
  });
  const up = rotate(actual.turn, [0, 1, 0]);
  const wanted = rotate(expected.turn, [0, 1, 0]);
  Arr.forEach(up, (value, index) => {
    expect(value).toBeCloseTo(Arr.getUnsafe(wanted, index), 9);
  });
}

describe("a thrown die", () => {
  it("reaches down by half its width lying flat, further on an edge", () => {
    expect(lowestPoint(IDENTITY)).toBeCloseTo(DIE.half, 12);
    expect(lowestPoint(axisAngle([1, 0, 0], Math.PI / 4))).toBeCloseTo(
      (DIE.half - DIE.radius) * Math.SQRT2 + DIE.radius,
      12
    );
  });

  it("falls, bounces lower twice and comes to rest", () => {
    const drop = 0.08;
    const fall = Math.sqrt((2 * drop) / 9.81);
    expect(airborne(0, drop)).toBe(drop);
    expect(airborne(fall, drop)).toBe(0);
    const firstFlight = 2 * Math.sqrt((2 * drop * 0.16) / 9.81);
    expect(airborne(fall + firstFlight / 2, drop)).toBeCloseTo(drop * 0.16, 9);
    expect(airborne(fall + firstFlight + 0.001, drop)).toBeGreaterThan(0);
    expect(airborne(5, drop)).toBe(0);
    Arr.forEach(Arr.range(0, 400), (step) => {
      expect(airborne(step / 1000, drop)).toBeGreaterThanOrEqual(0);
    });
  });

  it("lies flat on its face at the end of a throw", () => {
    const rest = restPose(SIX);
    expect(rest.position).toEqual([0.03, FELT + DIE.half, 0.01]);
    const top = rotate(rest.turn, [0, -1, 0]);
    expect(top[1]).toBeCloseTo(1, 12);
    expectSamePose(tumblePose(SIX, 1, 1, 1.32), rest);
    expectSamePose(tumblePose(SIX, 3, 1, 1.32), rest);
  });

  it("starts high and back along its lane, a short toss less so", () => {
    const start = tumblePose(FOUR, -1, 1, 1.32);
    expect(start.position[0]).toBeCloseTo(FOUR.rest[0] - TRAVEL, 12);
    expect(start.position[2]).toBeCloseTo(FOUR.lane, 12);
    expect(start.position[1]).toBeGreaterThan(FELT + 0.08);
    const short = tumblePose(FOUR, 0, 0.1, 0.13);
    expect(short.position[0]).toBeCloseTo(FOUR.rest[0] - TRAVEL * 0.1, 12);
    expect(short.position[1]).toBeLessThan(start.position[1]);
  });

  it("never cuts into the felt", () => {
    Arr.forEach([SIX, FOUR], (each) => {
      Arr.forEach(Arr.range(0, 200), (step) => {
        const pose = tumblePose(each, step / 200, 1, 1.32);
        expect(
          pose.position[1] - lowestPoint(pose.turn)
        ).toBeGreaterThanOrEqual(FELT - 1e-12);
      });
    });
  });

  it("is gathered up over the felt from one rest to the next throw", () => {
    const from = restPose(SIX);
    const to = tumblePose(FOUR, 0, 1, 1.32);
    expectSamePose(gatherPose(from, to, 0), from);
    expectSamePose(gatherPose(from, to, 1), to);
    const middle = gatherPose(from, to, 0.5);
    expect(middle.position[1]).toBeGreaterThan(
      (from.position[1] + to.position[1]) / 2
    );
    expect(
      middle.position[1] - lowestPoint(middle.turn)
    ).toBeGreaterThanOrEqual(FELT);
  });
});
