import { describe, expect, it } from "@effect/vitest";
import {
  quantizeCycle,
  stepCycle,
} from "@repo/design-system/components/contents/simulation/cycle";

describe("stepCycle", () => {
  it("advances linearly up to total without overshooting", () => {
    const mid = stepCycle(
      { hold: 0, value: 0.5 },
      { deltaSeconds: 0.25, holdSeconds: 1, rate: 0.5, total: 1 }
    );
    expect(mid.value).toBeCloseTo(0.625, 9);
    expect(mid.hold).toBe(0);

    const end = stepCycle(
      { hold: 0, value: 0.9 },
      { deltaSeconds: 0.5, holdSeconds: 1, rate: 0.5, total: 1 }
    );
    expect(end).toEqual({ hold: 0, value: 1 });
  });

  it("holds cleanly at total for holdSeconds before restarting at zero", () => {
    const holding = stepCycle(
      { hold: 0.2, value: 1 },
      { deltaSeconds: 0.5, holdSeconds: 1, rate: 0.5, total: 1 }
    );
    expect(holding).toEqual({ hold: 0.7, value: 1 });

    const looped = stepCycle(holding, {
      deltaSeconds: 0.3,
      holdSeconds: 1,
      rate: 0.5,
      total: 1,
    });
    expect(looped).toEqual({ hold: 0, value: 0 });
  });

  it("clamps non-positive delta, rate or total safely", () => {
    expect(
      stepCycle(
        { hold: -1, value: 5 },
        { deltaSeconds: 0, holdSeconds: 1, rate: 1, total: 2 }
      )
    ).toEqual({ hold: 0, value: 2 });
    expect(
      stepCycle(
        { hold: 0, value: -1 },
        { deltaSeconds: 0.1, holdSeconds: 1, rate: 0, total: 2 }
      )
    ).toEqual({ hold: 0, value: 0 });
    expect(
      stepCycle(
        { hold: 0, value: 0 },
        { deltaSeconds: 0.1, holdSeconds: 1, rate: 1, total: 0 }
      )
    ).toEqual({ hold: 0, value: 0 });
  });
});

describe("quantizeCycle", () => {
  it("snaps values to evenly spaced ticks within [0, total]", () => {
    expect(quantizeCycle(0.334, 1, 100)).toBeCloseTo(0.33, 9);
    expect(quantizeCycle(1.5, 1, 100)).toBe(1);
    expect(quantizeCycle(-0.2, 1, 100)).toBe(0);
    expect(quantizeCycle(0.4, 1, 0)).toBe(0.4);
  });
});
