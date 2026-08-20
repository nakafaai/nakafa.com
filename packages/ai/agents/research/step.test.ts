import { prepareResearchEvidenceStep } from "@repo/ai/agents/research/step";
import { describe, expect, it } from "vitest";

describe("research agent step state", () => {
  it("starts with inspectable web search before synthesis", () => {
    const step = prepareResearchEvidenceStep({
      hasWebSearchToolCall: false,
    });

    expect(step).toEqual({
      activeTools: ["webSearch"],
      toolChoice: { toolName: "webSearch", type: "tool" },
    });
    expect(
      prepareResearchEvidenceStep({
        hasWebSearchToolCall: true,
      })
    ).toBeUndefined();
  });
});
