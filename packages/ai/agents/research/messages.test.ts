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

  it("uses the plain task when no source evidence was prefetched", () => {
    expect(createResearchMessages("Find current docs.", [])).toEqual([
      { content: "Find current docs.", role: "user" },
    ]);
  });

  it("accepts structured markdown as the single research task", () => {
    const messages = createResearchMessages(
      [
        "# User Request",
        "Cache Components berubah apa menurut pihak pembuat Next.js sendiri?",
        "# Research Objective",
        "Find official Next.js 16 Cache Components changes.",
      ].join("\n\n"),
      []
    );

    expect(messages[0]?.content).toContain("# User Request");
    expect(messages[0]?.content).toContain(
      "Cache Components berubah apa menurut pihak pembuat Next.js sendiri?"
    );
    expect(messages[0]?.content).toContain("# Research Objective");
    expect(messages[0]?.content).toContain(
      "Find official Next.js 16 Cache Components changes."
    );
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
      task: "Research AI SDK DevTools.",
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
      task: "Research unavailable source.",
    });

    expect(messages[0]?.content).toContain("No usable evidence was collected.");
    expect(messages[0]?.content).not.toContain("# Source Evidence With URLs");
  });
});
