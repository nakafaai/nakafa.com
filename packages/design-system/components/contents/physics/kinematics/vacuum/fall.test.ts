import { describe, expect, it } from "@effect/vitest";
import {
  TUBE_DROP,
  tubeDrops,
  tubeTimes,
} from "@repo/design-system/components/contents/physics/kinematics/vacuum/fall";

describe("tubeTimes", () => {
  it("lands both together in a vacuum, after sqrt(2h/g)", () => {
    const times = tubeTimes("vacuum");
    expect(times.coin).toBeCloseTo(Math.sqrt(0.22));
    expect(times.feather).toBe(times.coin);
  });

  it("holds the feather back in air", () => {
    const times = tubeTimes("air");
    expect(times.feather).toBeCloseTo(2.25, 2);
    expect(times.feather).toBeGreaterThan(4 * times.coin);
  });
});

describe("tubeDrops", () => {
  it("keeps the two side by side in a vacuum", () => {
    const drops = tubeDrops("vacuum", 0.3);
    expect(drops.feather).toBe(drops.coin);
    expect(drops.coin).toBeCloseTo(0.45);
  });

  it("lands the feather exactly at its landing time in air", () => {
    const drops = tubeDrops("air", tubeTimes("air").feather);
    expect(drops.feather).toBeCloseTo(TUBE_DROP);
    expect(tubeDrops("air", 0.2).feather).toBeLessThan(0.1);
    expect(tubeDrops("air", 9).coin).toBe(TUBE_DROP);
    expect(tubeDrops("air", -1)).toEqual({ coin: 0, feather: 0 });
  });
});
