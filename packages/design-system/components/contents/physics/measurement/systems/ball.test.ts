import { describe, expect, it } from "@effect/vitest";
import {
  BALL_DIAMETER,
  BALL_MASS,
  ballIn,
} from "@repo/design-system/components/contents/physics/measurement/systems/ball";

describe("a bowling ball in three unit systems", () => {
  it("is 21.6 cm across and 7.26 kg", () => {
    expect(BALL_DIAMETER).toBeCloseTo(0.2159, 4);
    expect(BALL_MASS).toBeCloseTo(7.257, 3);
  });

  it("reads 0.708 ft and 16 lb in FPS", () => {
    expect(ballIn("fps").diameter).toBeCloseTo(0.7083, 4);
    expect(ballIn("fps").mass).toBeCloseTo(16, 9);
  });

  it("reads 21.6 cm and 7257 g in CGS, 0.216 m and 7.26 kg in MKS", () => {
    expect(ballIn("cgs").diameter).toBeCloseTo(21.59, 2);
    expect(ballIn("cgs").mass).toBeCloseTo(7257.5, 1);
    expect(ballIn("mks").diameter).toBeCloseTo(0.2159, 4);
    expect(ballIn("mks").mass).toBeCloseTo(7.2575, 4);
  });
});
