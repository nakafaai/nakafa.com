import {
  createResearchMessages,
  createResearchSynthesisMessages,
} from "@repo/ai/agents/research/messages";
import { describe, expect, it } from "vitest";

describe("research agent messages", () => {
  it("keeps search tools usable after source evidence is prefetched", () => {
    const messages = createResearchMessages(
      "Compare the source with updates.",
      ["# Scrape Result\n\nSource notes."]
    );

    expect(messages).toEqual([
      expect.objectContaining({
        content: expect.stringContaining("use the search tools"),
        role: "user",
      }),
    ]);
    expect(messages[0]?.content).toContain("# User-Provided Source Evidence");
    expect(messages[0]?.content).toContain("Source notes.");
  });

  it("uses the plain intent when no source evidence was prefetched", () => {
    expect(createResearchMessages("Find current docs.", [])).toEqual([
      { content: "Find current docs.", role: "user" },
    ]);
  });

  it("passes collected evidence to structured synthesis", () => {
    const messages = createResearchSynthesisMessages({
      collectedEvidence: [
        "# Web Search Results\n\n## Source 1: AI SDK\n- URL: https://ai-sdk.dev/docs\n- Inline citation: [AI SDK](https://ai-sdk.dev/docs)",
      ],
      evidence: "AI SDK DevTools captures generateText calls.",
      groundingSources: [
        {
          citation: "[AI SDK](https://ai-sdk.dev/docs)",
          content: "",
          description: "",
          title: "AI SDK",
          url: "https://ai-sdk.dev/docs",
        },
      ],
      intent: "Research AI SDK DevTools.",
    });

    expect(messages[0]?.content).toContain("# Research Task");
    expect(messages[0]?.content).toContain("# Research Notes");
    expect(messages[0]?.content).toContain(
      "AI SDK DevTools captures generateText calls."
    );
    expect(messages[0]?.content).toContain("# Grounding Source References");
    expect(messages[0]?.content).toContain("https://ai-sdk.dev/docs");
    expect(messages[0]?.content).toContain("# Source Evidence With URLs");
  });

  it("keeps synthesis explicit when no evidence was collected", () => {
    const messages = createResearchSynthesisMessages({
      evidence: "",
      intent: "Research unavailable source.",
    });

    expect(messages[0]?.content).toContain("No usable evidence was collected.");
    expect(messages[0]?.content).not.toContain("# Source Evidence With URLs");
  });
});
