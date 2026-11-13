import { describe, expect, it } from "@effect/vitest";
import {
  GripSchema,
  wrenchTorque,
} from "@repo/design-system/components/contents/physics/vector/wrench/torque";
import { Schema } from "effect";

const grip = Schema.decodeUnknownSync(GripSchema)({ arm: 0.4, force: 200 });

describe("wrenchTorque", () => {
  it("turns with 80 N·m when 200 N pulls square to a 0.4 m arm", () => {
    const turn = wrenchTorque(grip, 90);
    expect(turn.torque).toBeCloseTo(80, 10);
    expect(turn.along).toBeCloseTo(0, 10);
  });

  it("halves the torque at 30°, where only F sin θ turns the nut", () => {
    const turn = wrenchTorque(grip, 30);
    expect(turn.square).toBeCloseTo(100, 10);
    expect(turn.torque).toBeCloseTo(40, 10);
    expect(turn.along).toBeCloseTo(173.2, 1);
  });

  it("does nothing pulling straight along the handle", () => {
    expect(wrenchTorque(grip, 180).torque).toBeCloseTo(0, 10);
  });

  it("turns the other way, clockwise, for a push below the handle", () => {
    expect(wrenchTorque(grip, -90).torque).toBeCloseTo(-80, 10);
  });
});
