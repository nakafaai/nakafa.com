// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import { ballAt, hunterAt, scatterAt } from "@/lib/island/hunt";
import { SEA_LEVEL } from "@/lib/island/world";

/** How the shark moves against the ball over a hundredth of a second from `time`. */
const relativeStep = (time: number) => {
  const [shark, ball] = [hunterAt(3, time), ballAt(3, time)];
  const [later, ballLater] = [hunterAt(3, time + 0.01), ballAt(3, time + 0.01)];
  return [
    later.x - ballLater.x - (shark.x - ball.x),
    later.z - ballLater.z - (shark.z - ball.z),
  ] as const;
};

describe("island/hunt", () => {
  it("drifts the bait ball on a slow round of its own under the sea", () => {
    Arr.forEach([0, 40, 400], (time) => {
      const ball = ballAt(3, time);
      expect(Math.hypot(ball.x - SPAN / 2, ball.z - SPAN / 2)).toBeCloseTo(
        52.5
      );
      expect(ball.y).toBe(SEA_LEVEL - 2);
    });
    expect(ballAt(3, 10)).not.toEqual(ballAt(3, 0));
  });

  it("circles the shark round the bait ball, facing its way, then charges straight through its middle", () => {
    const away = (time: number) => {
      const [shark, ball] = [hunterAt(3, time), ballAt(3, time)];
      return Math.hypot(shark.x - ball.x, shark.z - ball.z);
    };
    Arr.forEach([0, 5, 13.9, 15.3, 29], (time) =>
      expect(away(time)).toBeCloseTo(2.4, 1)
    );
    expect(away(14.6)).toBeLessThan(0.3);
    // Measured against the drifting ball, the shark faces the way it swims.
    Arr.forEach([3, 14.3], (time) => {
      const [dx, dz] = relativeStep(time);
      expect(Math.atan2(dx, dz)).toBeCloseTo(hunterAt(3, time).yaw, 1);
    });
    // Each charge leaves the shark on the far side of the circle, and its circling picks up from there.
    const [end, next] = [hunterAt(3, 15.199), hunterAt(3, 15.2)];
    expect(Math.hypot(end.x - next.x, end.z - next.z)).toBeLessThan(0.05);
  });

  it("bursts the bait ball apart across the shark's line as it charges, and closes it again after", () => {
    expect(scatterAt(3, 5).burst).toBe(0);
    expect(scatterAt(3, 16.2).burst).toBeGreaterThan(0.9);
    expect(scatterAt(3, 20).burst).toBe(0);
    expect(scatterAt(3, 15.2 + 15.2 + 1).burst).toBeGreaterThan(0);
    // The way across is square to the charge.
    const { across } = scatterAt(3, 14.5);
    const [dx, dz] = relativeStep(14.5);
    expect(Math.abs(across.x * dx + across.z * dz)).toBeLessThan(0.001);
  });
});
