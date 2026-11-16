import { describe, expect, it } from "@effect/vitest";
import {
  TRAP_CENTRE,
  trapArrival,
  trapPosition,
  trapReading,
} from "@repo/design-system/components/contents/physics/kinematics/trap/gates";
import { Array as Arr } from "effect";

describe("trap motion", () => {
  it("reaches the centre at 5 s, moving at 20 m/s", () => {
    expect(trapArrival(TRAP_CENTRE)).toBeCloseTo(5);
    expect(trapPosition(5)).toBe(50);
    expect(trapPosition(-1)).toBe(0);
  });
});

describe("trapReading", () => {
  it("reads below the centre speed for a wide gap", () => {
    const wide = trapReading(40);
    expect(wide.enter).toBeCloseTo(Math.sqrt(15));
    expect(wide.leave).toBeCloseTo(Math.sqrt(35));
    expect(wide.average).toBeCloseTo(19.58, 2);
  });

  it("closes in on the instantaneous speed as the gap shrinks", () => {
    const readings = [40, 20, 10, 2] as const;
    const errors = Arr.map(
      readings,
      (gap) => trapReading(gap).instant - trapReading(gap).average
    );
    expect(errors[0]).toBeGreaterThan(errors[1] ?? 0);
    expect(errors[1]).toBeGreaterThan(errors[2] ?? 0);
    expect(errors[2]).toBeGreaterThan(errors[3] ?? 0);
    expect(trapReading(2).average).toBeCloseTo(20, 1);
    expect(trapReading(2).instant).toBeCloseTo(20);
  });
});
