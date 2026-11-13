import { describe, expect, it } from "@effect/vitest";
import {
  STROBE_SHOTS,
  strobeBalls,
  strobeFacts,
  strobeFlashes,
} from "@repo/design-system/components/contents/physics/kinematics/strobe/flash";
import { Array as Arr, Option } from "effect";

describe("strobe shots", () => {
  it("lands every falling ball on the floor at the end of its shot", () => {
    for (const shot of ["drop", "launch", "components"] as const) {
      for (const ball of strobeBalls(shot, STROBE_SHOTS[shot].duration)) {
        expect(ball.y).toBeCloseTo(0);
      }
    }
  });

  it("brings the toss back to the hand after 1 s, at the top after 0.5 s", () => {
    expect(strobeBalls("toss", 1)[0]?.y).toBeCloseTo(0);
    expect(strobeBalls("toss", 0.5)[0]?.vy).toBeCloseTo(0);
  });

  it("keeps the dropped and the launched ball at the same height at every flash", () => {
    for (const time of strobeFlashes("launch")) {
      const [dropped, launched] = strobeBalls("launch", time);
      expect(dropped?.y).toBeCloseTo(launched?.y ?? Number.NaN);
    }
  });
});

describe("strobeFlashes", () => {
  it("flashes at equal intervals from release to the end", () => {
    expect(strobeFlashes("drop")).toHaveLength(7);
    expect(strobeFlashes("launch")).toHaveLength(11);
    expect(
      Option.getOrThrow(Arr.last(strobeFlashes("components")))
    ).toBeCloseTo(1.6);
  });
});

describe("strobeFacts", () => {
  it("reads each shot's outcome", () => {
    expect(strobeFacts("drop")).toEqual({
      airTime: 0.6,
      height: 1.8,
      outcome: 6,
    });
    expect(strobeFacts("toss").outcome).toBeCloseTo(1.25);
    expect(strobeFacts("launch").outcome).toBeCloseTo(2);
    expect(strobeFacts("components").outcome).toBeCloseTo(9.6);
  });
});
