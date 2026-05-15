import {
  prepareGoogleGroundingStep,
  prepareResearchEvidenceStep,
} from "@repo/ai/agents/research/step";
import type { ModelMessage } from "ai";
import { describe, expect, it } from "vitest";

const messages = [
  { role: "user", content: "research latest climate data" },
] satisfies ModelMessage[];

describe("research agent step state", () => {
  it("starts with inspectable web search before provider grounding", () => {
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

  it("enables only Google Search grounding after Firecrawl", () => {
    const step = prepareGoogleGroundingStep(messages);

    expect(step.activeTools).toEqual(["google_search"]);
    expect(step.toolChoice).toBe("required");
    expect(step.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Firecrawl webSearch is complete"),
        role: "user",
      })
    );
  });
});
