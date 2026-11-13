import { describe, expect, it } from "@effect/vitest";
import {
  REFLECTOR_RADIUS,
  spinAt,
  VALVE_RADIUS,
} from "@repo/design-system/components/contents/physics/kinematics/wheel/spin";

describe("spinAt", () => {
  it("gives every point one angular speed, 2 pi over the period", () => {
    expect(spinAt(1, VALVE_RADIUS).angular).toBeCloseTo(2 * Math.PI);
    expect(spinAt(1, REFLECTOR_RADIUS).angular).toBeCloseTo(2 * Math.PI);
  });

  it("moves the valve about twice as fast as the reflector halfway in", () => {
    const valve = spinAt(1, VALVE_RADIUS);
    const reflector = spinAt(1, REFLECTOR_RADIUS);
    expect(valve.speed).toBeCloseTo(1.954, 3);
    expect(valve.speed / reflector.speed).toBeCloseTo(
      VALVE_RADIUS / REFLECTOR_RADIUS
    );
  });

  it("quadruples the centripetal acceleration when the period halves", () => {
    expect(
      spinAt(0.5, VALVE_RADIUS).acceleration /
        spinAt(1, VALVE_RADIUS).acceleration
    ).toBeCloseTo(4);
  });
});
