import { describe, expect, it } from "@effect/vitest";
import {
  releaseTime,
  slingPlace,
  whirl,
} from "@repo/design-system/components/contents/physics/kinematics/sling/whirl";

describe("whirl", () => {
  it("moves a 0.8 m whirl of period 0.8 s at 2 pi m/s with a = v^2 / r", () => {
    const motion = whirl(0.8, 0.8);
    expect(motion.speed).toBeCloseTo(2 * Math.PI);
    expect(motion.acceleration).toBeCloseTo(
      (motion.speed * motion.speed) / 0.8
    );
  });
});

describe("slingPlace", () => {
  it("keeps the ball on the circle before release", () => {
    const place = slingPlace(0.8, 0.8, "north", 0.2);
    expect(place.released).toBe(false);
    expect(Math.hypot(place.x, place.y)).toBeCloseTo(0.8);
  });

  it("flies off along the tangent after release at the north point", () => {
    const after = releaseTime(0.8, "north") + 0.1;
    const place = slingPlace(0.8, 0.8, "north", after);
    expect(place.released).toBe(true);
    expect(place.y).toBeCloseTo(0.8);
    expect(place.x).toBeCloseTo(-2 * Math.PI * 0.1);
  });

  it("releases after two turns plus the way to the release point", () => {
    expect(releaseTime(0.8, "east")).toBeCloseTo(1.6);
    expect(releaseTime(0.8, "south")).toBeCloseTo(2.2);
    expect(slingPlace(0.8, 0.8, "east", -1).x).toBeCloseTo(0.8);
  });
});
