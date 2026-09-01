import { describe, expect, it } from "@effect/vitest";
import { prepareMathStep } from "@repo/ai/agents/math/step";

describe("prepareMathStep", () => {
  it("requires one deterministic math tool on the first step", () => {
    expect(prepareMathStep({ stepNumber: 0 })).toEqual({
      toolChoice: "required",
    });
  });

  it("returns normal tool choice after the first step", () => {
    expect(prepareMathStep({ stepNumber: 1 })).toBeUndefined();
  });
});
