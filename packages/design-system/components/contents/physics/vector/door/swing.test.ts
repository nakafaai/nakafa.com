import { describe, expect, it } from "@effect/vitest";
import {
  DoorSchema,
  doorTorque,
  swingAngle,
} from "@repo/design-system/components/contents/physics/vector/door/swing";
import { Schema } from "effect";

const door = Schema.decodeUnknownSync(DoorSchema)({
  force: 20,
  mass: 18,
  width: 0.9,
});

describe("doorTorque", () => {
  it("turns with 16 N·m pushing 20 N square at the handle, 0.8 m out", () => {
    const push = doorTorque(door, 0.8, 90);
    expect(push.torque).toBeCloseTo(16, 10);
    expect(push.spin).toBeCloseTo(16 / 4.86, 10);
  });

  it("gives a quarter of the torque near the hinge at a slant of 30°", () => {
    expect(doorTorque(door, 0.4, 30).torque).toBeCloseTo(4, 10);
  });

  it("gives no torque pushing along the door", () => {
    expect(doorTorque(door, 0.8, 0).torque).toBeCloseTo(0, 10);
  });
});

describe("swingAngle", () => {
  it("turns half the angular acceleration times the time squared", () => {
    expect(swingAngle(1, 1)).toBeCloseTo(28.648, 3);
  });

  it("stops wide open at 90°", () => {
    expect(swingAngle(1, 10)).toBe(90);
  });
});
