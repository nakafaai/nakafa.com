// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import type { Orbit } from "@/lib/island/camera";
import { DISTANCE } from "@/lib/island/camera";
import { viewProjectionOf } from "@/lib/island/matrix";
import { portraitOf } from "@/lib/island/portrait";
import { shoreOf } from "@/lib/island/terrain";
import { SEA_LEVEL } from "@/lib/island/world";

/** The farthest any point of a ring `reach` cells round the island's middle lies from the frame's middle, in clip coordinates. */
const widest = (orbit: Orbit, aspect: number, reach: number) => {
  const m = viewProjectionOf(orbit, aspect);
  return Math.max(
    ...Arr.makeBy(64, (index) => {
      const angle = (index / 64) * Math.PI * 2;
      const [x, y, z] = [
        SPAN / 2 + Math.cos(angle) * reach,
        SEA_LEVEL,
        SPAN / 2 + Math.sin(angle) * reach,
      ];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      return Math.max(
        Math.abs((m[0] * x + m[4] * y + m[8] * z + m[12]) / w),
        Math.abs((m[1] * x + m[5] * y + m[9] * z + m[13]) / w)
      );
    })
  );
};

describe("island/portrait", () => {
  it("frames the whole island and its shore on any card, as near as holds it", () => {
    for (const size of [52, 64]) {
      for (const aspect of [1.33, 1, 0.75, 2]) {
        const orbit = portraitOf(size, aspect);
        const reach = shoreOf(size) + 3;
        expect(widest(orbit, aspect, reach)).toBeLessThanOrEqual(0.95);
        // A little nearer and the shore slips out of the frame, so the island is drawn as large as it fits.
        const nearer = { ...orbit, distance: orbit.distance * 0.92 };
        expect(widest(nearer, aspect, reach)).toBeGreaterThan(0.94);
      }
    }
  });

  it("looks at the island's middle from the south-east, a little higher than the game opens", () => {
    const orbit = portraitOf(52, 1.33);
    expect(orbit.target).toEqual([SPAN / 2, SEA_LEVEL, SPAN / 2]);
    expect(orbit.yaw).toBeCloseTo(Math.PI / 4);
    expect(orbit.pitch).toBeCloseTo(0.8);
  });

  it("never draws from past the camera's farthest, however narrow the card", () => {
    expect(portraitOf(64, 0.05).distance).toBeCloseTo(DISTANCE.far, 3);
  });
});
