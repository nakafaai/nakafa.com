import { describe, expect, it } from "@effect/vitest";
import {
  bearingVector,
  CrosswindSchema,
  cosineSpeed,
  groundVelocity,
  signedAngle,
  sineDrift,
} from "@repo/design-system/components/contents/physics/vector/aircraft/drift";
import { Schema } from "effect";

const flight = Schema.decodeSync(CrosswindSchema)({
  airspeed: 400,
  toward: 90,
  wind: 300,
});

describe("bearingVector", () => {
  it("points a bearing of 90 degrees due east", () => {
    const vector = bearingVector(10, 90);
    expect(vector.east).toBeCloseTo(10, 10);
    expect(vector.north).toBeCloseTo(0, 10);
  });
});

describe("signedAngle", () => {
  it("keeps angles within half a turn either way", () => {
    expect(signedAngle(350)).toBe(-10);
    expect(signedAngle(-190)).toBe(170);
    expect(signedAngle(180)).toBe(180);
  });
});

describe("groundVelocity", () => {
  it("adds 400 km/h north and 300 km/h east into 500 km/h on 36.87°", () => {
    const ground = groundVelocity(flight, 0);
    expect(ground.speed).toBeCloseTo(500, 10);
    expect(ground.track).toBeCloseTo(36.87, 2);
    expect(ground.drift).toBeCloseTo(36.87, 2);
    expect(ground.between).toBe(90);
  });

  it("drifts left when the wind blows from the right", () => {
    const ground = groundVelocity(flight, 180);
    expect(ground.drift).toBeCloseTo(-36.87, 2);
    expect(ground.track).toBeCloseTo(143.13, 2);
  });

  it("agrees with the cosine and sine rules at 60° between", () => {
    const ground = groundVelocity(flight, 30);
    expect(ground.between).toBe(60);
    expect(cosineSpeed(400, 300, 60)).toBeCloseTo(ground.speed, 10);
    expect(sineDrift(300, 60, ground.speed)).toBeCloseTo(ground.drift, 10);
  });

  it("slows straight into a headwind with no drift", () => {
    const ground = groundVelocity(flight, 270);
    expect(ground.speed).toBeCloseTo(100, 10);
    expect(ground.drift).toBeCloseTo(0, 10);
    expect(ground.between).toBe(180);
  });
});

describe("sineDrift", () => {
  it("has no drift when the plane stands still over the ground", () => {
    expect(sineDrift(300, 180, 0)).toBe(0);
  });
});

describe("cosineSpeed", () => {
  it("never takes the root of a negative rounding error", () => {
    expect(cosineSpeed(300, 300, 180)).toBe(0);
  });
});
