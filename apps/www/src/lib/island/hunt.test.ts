// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { ballAt, HUNT_REACH, hunterAt, scatterAt } from "@/lib/island/hunt";

/** A hunt about a place far from the origin, its ball six blocks under a sea whose face lies at 8. */
const HUNT = { lane: 5, seed: 3, x: 400, y: 6, z: -200 };

/** How the shark moves against the ball over a hundredth of a second from `time`. */
const relativeStep = (time: number) => {
  const [shark, ball] = [hunterAt(HUNT, time), ballAt(HUNT, time)];
  const [later, ballLater] = [
    hunterAt(HUNT, time + 0.01),
    ballAt(HUNT, time + 0.01),
  ];
  return [
    later.x - ballLater.x - (shark.x - ball.x),
    later.z - ballLater.z - (shark.z - ball.z),
  ] as const;
};

describe("island/hunt", () => {
  it("drifts the bait ball on a slow round of its own about its place, at its depth", () => {
    Arr.forEach([0, 40, 400], (time) => {
      const ball = ballAt(HUNT, time);
      expect(Math.hypot(ball.x - HUNT.x, ball.z - HUNT.z)).toBeCloseTo(5);
      expect(ball.y).toBe(6);
    });
    expect(ballAt(HUNT, 10)).not.toEqual(ballAt(HUNT, 0));
    expect(ballAt({ ...HUNT, seed: 4 }, 0)).not.toEqual(ballAt(HUNT, 0));
  });

  it("circles the shark round the bait ball, facing its way, then charges straight through its middle", () => {
    const away = (time: number) => {
      const [shark, ball] = [hunterAt(HUNT, time), ballAt(HUNT, time)];
      return Math.hypot(shark.x - ball.x, shark.z - ball.z);
    };
    Arr.forEach([0, 5, 13.9, 15.3, 29], (time) =>
      expect(away(time)).toBeCloseTo(2.4, 1)
    );
    expect(away(14.6)).toBeLessThan(0.3);
    expect(HUNT_REACH).toBeGreaterThan(2.4);
    // Measured against the drifting ball, the shark faces the way it swims.
    Arr.forEach([3, 14.3], (time) => {
      const [dx, dz] = relativeStep(time);
      expect(Math.atan2(dx, dz)).toBeCloseTo(hunterAt(HUNT, time).yaw, 1);
    });
    // Each charge leaves the shark on the far side of the circle, and its circling picks up from there.
    const [end, next] = [hunterAt(HUNT, 15.199), hunterAt(HUNT, 15.2)];
    expect(Math.hypot(end.x - next.x, end.z - next.z)).toBeLessThan(0.05);
  });

  it("bursts the bait ball apart across the shark's line as it charges, and closes it again after", () => {
    expect(scatterAt(HUNT, 5).burst).toBe(0);
    expect(scatterAt(HUNT, 16.2).burst).toBeGreaterThan(0.9);
    expect(scatterAt(HUNT, 20).burst).toBe(0);
    expect(scatterAt(HUNT, 15.2 + 15.2 + 1).burst).toBeGreaterThan(0);
    // The way across is square to the charge.
    const { across } = scatterAt(HUNT, 14.5);
    const [dx, dz] = relativeStep(14.5);
    expect(Math.abs(across.x * dx + across.z * dz)).toBeLessThan(0.001);
  });
});
