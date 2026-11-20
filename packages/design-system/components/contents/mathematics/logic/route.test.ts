// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { LAYOUTS } from "@repo/design-system/components/contents/mathematics/logic/circuit";
import {
  BITE_Y,
  BOARD_TOP,
  CLIP,
  WIRE_RADIUS,
} from "@repo/design-system/components/contents/mathematics/logic/rig";
import {
  CURRENT,
  clipPose,
  DROP,
  leadPath,
  marksAlong,
} from "@repo/design-system/components/contents/mathematics/logic/route";
import { Array as Arr } from "effect";

describe("the leads", () => {
  it("bites each post with a clip that points toward the lead's first turn", () => {
    const layout = LAYOUTS.and;
    const lead = Arr.getUnsafe(layout.leads, 1);
    const start = clipPose(layout, 1, "from");
    expect(start.jaw).toEqual([lead.start[0], BITE_Y, lead.start[1]]);
    const [turnX, turnZ] = Arr.headNonEmpty(lead.via);
    const heading = Math.atan2(-(turnZ - lead.start[1]), turnX - lead.start[0]);
    expect(start.heading).toBeCloseTo(heading);
    const end = clipPose(layout, 1, "to");
    expect(end.jaw).toEqual([lead.end[0], BITE_Y, lead.end[1]]);
  });

  it("lifts a clip stacked on a shared post above the one under it", () => {
    expect(clipPose(LAYOUTS.or, 1, "from").jaw[1]).toBeCloseTo(
      BITE_Y + CLIP.rise
    );
  });

  it("runs a lead out of its clips, down onto the board and through its turns", () => {
    const layout = LAYOUTS.or;
    for (const [index, lead] of Arr.map(
      layout.leads,
      (each, at) => [at, each] as const
    )) {
      const path = leadPath(layout, index);
      expect(path).toHaveLength(lead.via.length + 4);
      const lying = Arr.filter(path, ([, y]) => y === BOARD_TOP + WIRE_RADIUS);
      expect(lying).toHaveLength(lead.via.length + 2);
      const [first] = path;
      const start = clipPose(layout, index, "from").jaw;
      expect(first?.[1]).toBe(start[1]);
      expect(
        Math.hypot((first?.[0] ?? 0) - start[0], (first?.[2] ?? 0) - start[2])
      ).toBeCloseTo(CLIP.length);
    }
  });

  it("turns every lead well clear of its clips, so it never kinks back over them", () => {
    const clear = CLIP.length + DROP + 0.01;
    for (const layout of [LAYOUTS.and, LAYOUTS.or, LAYOUTS.not]) {
      for (const lead of layout.leads) {
        const first = Arr.headNonEmpty(lead.via);
        const last = Arr.lastNonEmpty(lead.via);
        expect(
          Math.hypot(first[0] - lead.start[0], first[1] - lead.start[1])
        ).toBeGreaterThan(clear);
        expect(
          Math.hypot(last[0] - lead.end[0], last[1] - lead.end[1])
        ).toBeGreaterThan(clear);
      }
    }
  });

  it("spaces the marks of current evenly and runs them along the lead", () => {
    const still = marksAlong(0.11, 0);
    expect(still).toHaveLength(Math.floor(0.11 / CURRENT.gap));
    expect(Arr.getUnsafe(still, 0)).toBe(0);
    const later = marksAlong(0.11, 0.2);
    expect(Arr.getUnsafe(later, 0)).toBeCloseTo((0.2 * CURRENT.speed) / 0.11);
    expect(marksAlong(0.005, 0)).toEqual([0]);
    for (const share of marksAlong(0.3, 37)) {
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThan(1);
    }
  });
});
