import { prepareMathStep } from "@repo/ai/agents/math/step";
import { describe, expect, it } from "vitest";

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
