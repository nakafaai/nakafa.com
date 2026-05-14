import type { WebSearchOutput } from "@repo/ai/agents/research/schema";
import {
  hasUsableWebSearchEvidence,
  prepareGoogleGroundingStep,
  prepareWebSearchStep,
} from "@repo/ai/agents/research/step";
import { describe, expect, it } from "vitest";

const firstSource = {
  citation: "[Example](https://example.com/research)",
  content: "Research content.",
  description: "Research description.",
  title: "Research Source",
  url: "https://example.com/research",
};

const searchOutput = {
  sources: [firstSource],
} satisfies WebSearchOutput;

describe("research agent step state", () => {
  it("treats Firecrawl markdown content as usable evidence", () => {
    expect(hasUsableWebSearchEvidence(searchOutput)).toBe(true);
  });

  it("starts with inspectable web search before provider-only grounding", () => {
    const step = prepareWebSearchStep({
      hasSourceReferences: false,
      hasWebSearchToolCall: false,
    });

    expect(step).toEqual({
      activeTools: ["webSearch"],
      toolChoice: { toolName: "webSearch", type: "tool" },
    });
    expect(
      prepareWebSearchStep({
        hasSourceReferences: false,
        hasWebSearchToolCall: true,
      })
    ).toBeUndefined();
  });

  it("keeps exact source requests scoped to scrape", () => {
    expect(
      prepareWebSearchStep({
        hasSourceReferences: true,
        hasWebSearchToolCall: false,
      })
    ).toEqual({
      activeTools: ["scrape"],
    });
  });

  it("requires grounding when Firecrawl returns no usable content", () => {
    const missingContent = {
      sources: [
        {
          citation: "[Example](https://example.com/research)",
          content: "",
          description: "Search metadata without markdown.",
          title: "Research Source",
          url: "https://example.com/research",
        },
      ],
    } satisfies WebSearchOutput;

    expect(hasUsableWebSearchEvidence(missingContent)).toBe(false);
    expect(
      hasUsableWebSearchEvidence({
        sources: [],
        error: "Search failed.",
      })
    ).toBe(false);
  });

  it("enables only Google Search grounding for missing Firecrawl content", () => {
    const messages = [
      { role: "user", content: "research latest climate data" },
    ] satisfies Parameters<typeof prepareGoogleGroundingStep>[0];

    const step = prepareGoogleGroundingStep(messages);

    expect(step.activeTools).toEqual(["google_search"]);
    expect(step.toolChoice).toBe("required");
    expect(step.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Google Search grounding"),
        role: "user",
      })
    );
  });
});
