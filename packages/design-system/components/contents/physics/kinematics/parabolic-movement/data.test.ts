import { describe, expect, it } from "@effect/vitest";
import {
  DEFAULT_PARABOLIC_LAUNCH_ID,
  formatAngleMath,
  getParabolicLoopSample,
  getParabolicMotionState,
  getProjectilePoint,
  getProjectileVelocityAt,
  getRestingProjectileSample,
  isParabolicLaunchId,
  PARABOLIC_LAUNCHES,
  PARABOLIC_SCENE,
  toSceneTuple,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";

/** One loop of the lab: its flight, then its pause at the landing. */
const LOOP_SECONDS =
  PARABOLIC_SCENE.animationSeconds + PARABOLIC_SCENE.pauseSeconds;

describe("parabolic launch math", () => {
  it("lands every launch back on the ground", () => {
    for (const launch of PARABOLIC_LAUNCHES) {
      const motion = getParabolicMotionState(launch.id);

      expect(getProjectilePoint(motion, motion.flightTime).yMeters).toBeCloseTo(
        0
      );
    }
  });

  it("carries the ball half its range by the middle of the flight", () => {
    const motion = getParabolicMotionState(DEFAULT_PARABOLIC_LAUNCH_ID);

    expect(
      getProjectilePoint(motion, motion.flightTime / 2).xMeters
    ).toBeCloseTo(motion.range / 2);
  });

  it("reaches the peak in the middle of the flight, where its vertical speed is zero", () => {
    const motion = getParabolicMotionState(DEFAULT_PARABOLIC_LAUNCH_ID);

    expect(motion.peakTime).toBeCloseTo(motion.flightTime / 2);
    expect(
      getProjectileVelocityAt(motion, motion.peakTime).verticalVelocity
    ).toBeCloseTo(0);
  });

  it("gives the peak height the average vertical speed over the rise", () => {
    const motion = getParabolicMotionState(DEFAULT_PARABOLIC_LAUNCH_ID);

    expect(motion.peakHeight).toBeCloseTo(
      (motion.verticalVelocity * motion.peakTime) / 2
    );
  });

  it("rests the reduced-motion ball at the top of its arc", () => {
    const motion = getParabolicMotionState(DEFAULT_PARABOLIC_LAUNCH_ID);
    const rest = getRestingProjectileSample(motion);

    expect(rest.time).toBeCloseTo(motion.peakTime);
    expect(rest.point.yMeters).toBeCloseTo(motion.peakHeight);
    expect(rest.point.x).toBeCloseTo(0);
  });

  it("starts the loop at the launch and pauses the ball at the landing", () => {
    const motion = getParabolicMotionState(DEFAULT_PARABOLIC_LAUNCH_ID);
    const launch = getParabolicLoopSample(motion, 0);
    const landed = getParabolicLoopSample(
      motion,
      PARABOLIC_SCENE.animationSeconds + PARABOLIC_SCENE.pauseSeconds / 2
    );

    expect(launch.isFlying).toBe(true);
    expect(launch.point.xMeters).toBeCloseTo(0);
    expect(launch.point.yMeters).toBeCloseTo(0);
    expect(landed.isFlying).toBe(false);
    expect(landed.point.xMeters).toBeCloseTo(motion.range);
    expect(landed.point.yMeters).toBeCloseTo(0);
  });

  it("starts the next loop at the launch once the pause ends", () => {
    const motion = getParabolicMotionState(DEFAULT_PARABOLIC_LAUNCH_ID);
    const next = getParabolicLoopSample(motion, LOOP_SECONDS);

    expect(next.isFlying).toBe(true);
    expect(next.point.xMeters).toBeCloseTo(0);
  });

  it("clamps a time outside the flight to its launch and its landing", () => {
    const motion = getParabolicMotionState(DEFAULT_PARABOLIC_LAUNCH_ID);

    expect(getProjectilePoint(motion, -1).time).toBe(0);
    expect(getProjectilePoint(motion, motion.flightTime + 1).time).toBe(
      motion.flightTime
    );
  });

  it("accepts the lab's launch ids and rejects any other text", () => {
    expect(isParabolicLaunchId(DEFAULT_PARABOLIC_LAUNCH_ID)).toBe(true);
    expect(isParabolicLaunchId("vertical-angle")).toBe(false);
  });

  it("writes a whole launch angle without a zero tenth", () => {
    expect(formatAngleMath(64)).toBe("\\theta=64^\\circ");
  });

  it("lifts a point of the ground by the ball's radius, so the ball rests on the contact plane", () => {
    expect(toSceneTuple(1.5, 0, -2)).toEqual([
      1.5,
      PARABOLIC_SCENE.ballRadius,
      -2,
    ]);
  });
});
