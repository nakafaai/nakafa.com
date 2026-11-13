import { describe, expect, it } from "@effect/vitest";
import {
  gateReading,
  TROLLEY_SPEED,
} from "@repo/design-system/components/contents/physics/measurement/gate/timing";

describe("speed from two light gates", () => {
  it("times 0.60 m between the gates as 1.250 s, 0.48 m/s", () => {
    const reading = gateReading(0.6);
    expect(reading.time).toBe(1.25);
    expect(reading.speed).toBeCloseTo(0.48, 12);
  });

  it("gives the same speed wherever the gates stand", () => {
    for (const distance of [0.2, 0.45, 1.2]) {
      expect(gateReading(distance).speed).toBeCloseTo(TROLLEY_SPEED, 2);
    }
  });
});
