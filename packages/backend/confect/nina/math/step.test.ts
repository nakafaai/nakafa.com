import { describe, expect, it } from "@effect/vitest";
import { purposes } from "@repo/backend/confect/gateway/purpose";
import {
  MATH_STEPS,
  prepareMathStep,
} from "@repo/backend/confect/nina/math/step";

describe("prepareMathStep", () => {
  it("requires one deterministic math tool on the first step", () => {
    expect(prepareMathStep({ stepNumber: 0 })).toEqual({
      toolChoice: "required",
    });
  });

  it("returns normal tool choice between the first and the last step", () => {
    expect(prepareMathStep({ stepNumber: 1 })).toBeUndefined();
    expect(prepareMathStep({ stepNumber: MATH_STEPS - 2 })).toBeUndefined();
  });

  it("allows no tool on the last step, so a run always ends with its answer", () => {
    expect(prepareMathStep({ stepNumber: MATH_STEPS - 1 })).toEqual({
      toolChoice: "none",
    });
  });
});

describe("MATH_STEPS", () => {
  it("holds as many steps of the step deadline as fit the total deadline", () => {
    const { stepMs, totalMs } = purposes.specialist.timeout;

    expect(MATH_STEPS * stepMs).toBeLessThanOrEqual(totalMs);
    expect((MATH_STEPS + 1) * stepMs).toBeGreaterThan(totalMs);
    // A derivative and its value need a tool step each, and an answer.
    expect(MATH_STEPS).toBeGreaterThanOrEqual(3);
  });
});
