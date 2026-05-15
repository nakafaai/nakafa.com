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
      evidence: "AI SDK DevTools captures generateText calls.",
      intent: "Research AI SDK DevTools.",
      sourceOutputs: ["# Scrape Result\n\nOfficial docs."],
    });

    expect(messages[0]?.content).toContain("# Research Task");
    expect(messages[0]?.content).toContain("# Collected Evidence");
    expect(messages[0]?.content).toContain(
      "AI SDK DevTools captures generateText calls."
    );
    expect(messages[0]?.content).toContain("# User-Provided Source Evidence");
  });

  it("keeps synthesis explicit when no evidence was collected", () => {
    const messages = createResearchSynthesisMessages({
      evidence: "",
      intent: "Research unavailable source.",
      sourceOutputs: [],
    });

    expect(messages[0]?.content).toContain("No usable evidence was collected.");
    expect(messages[0]?.content).not.toContain(
      "# User-Provided Source Evidence"
    );
  });
});
