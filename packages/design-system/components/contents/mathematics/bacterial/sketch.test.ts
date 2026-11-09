import { describe, expect, it } from "@effect/vitest";
import {
  NO_DIVISION,
  stepDivision,
} from "@repo/design-system/components/contents/mathematics/bacterial/sketch";

const clock = {
  elapsed: 250,
  generation: 1,
  interval: 1000,
  maxGenerations: 3,
  playing: true,
};

describe("bacteria division", () => {
  it("divides over one interval and reports the end once", () => {
    const first = stepDivision(NO_DIVISION, clock);
    const second = stepDivision(first.division, clock);
    const third = stepDivision(second.division, clock);
    const fourth = stepDivision(third.division, clock);
    const fifth = stepDivision(fourth.division, clock);

    expect(first).toEqual({
      division: { generation: 1, phase: 0.25 },
      ended: false,
    });
    expect(third).toEqual({
      division: { generation: 1, phase: 0.75 },
      ended: false,
    });
    expect(fourth).toEqual({
      division: { generation: 1, phase: 1 },
      ended: true,
    });
    expect(fifth).toEqual({
      division: { generation: 1, phase: 1 },
      ended: false,
    });
  });

  it("holds a paused generation and starts a newly chosen one from its growth", () => {
    const paused = { ...clock, playing: false };
    const held = stepDivision({ generation: 1, phase: 0.4 }, paused);
    expect(held).toEqual({
      division: { generation: 1, phase: 0.4 },
      ended: false,
    });

    const chosen = stepDivision(held.division, { ...paused, generation: 2 });
    expect(chosen.division).toEqual({ generation: 2, phase: 0 });
  });

  it("stops at the last generation", () => {
    const last = stepDivision(NO_DIVISION, { ...clock, generation: 3 });
    expect(last).toEqual({
      division: { generation: 3, phase: 0 },
      ended: false,
    });
  });
});
