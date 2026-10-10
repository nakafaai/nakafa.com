import { describe, expect, it } from "@effect/vitest";
import {
  createResearchSearchMessages,
  createResearchSynthesisMessages,
} from "@repo/backend/confect/nina/research/messages";
import { Array as Arr } from "effect";

describe("research agent messages", () => {
  it("shows the search step what the learner's own sources already gave", () => {
    const messages = createResearchSearchMessages(
      "Compare the source with updates.",
      ["# Scrape Result\n\nSource notes."]
    );

    expect(messages).toEqual([
      expect.objectContaining({
        content: expect.stringContaining(
          "Search for current, external, or corroborating evidence they do not cover."
        ),
        role: "user",
      }),
    ]);
    expect(messages[0]?.content).toContain("# User-Provided Source Evidence");
    expect(messages[0]?.content).toContain("Source notes.");
  });

  it("uses the plain task when no source evidence was prefetched", () => {
    expect(createResearchSearchMessages("Find current docs.", [])).toEqual([
      { content: "Find current docs.", role: "user" },
    ]);
  });

  it("accepts structured markdown as the single research task", () => {
    const messages = createResearchSearchMessages(
      Arr.join(
        [
          "# User Request",
          "Cache Components berubah apa menurut pihak pembuat Next.js sendiri?",
          "# Research Objective",
          "Find official Next.js 16 Cache Components changes.",
        ],
        "\n\n"
      ),
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

  it("passes the task and every collected source to structured synthesis", () => {
    const messages = createResearchSynthesisMessages({
      evidence: [
        "# Scrape Result\n- URL: https://nakafa.com/source",
        "# Web Search Results\n\n## Source 1: AI SDK\n- URL: https://ai-sdk.dev/docs",
      ],
      task: "Research AI SDK DevTools.",
    });

    expect(messages).toEqual([
      {
        role: "user",
        content: Arr.join(
          [
            "# Research Task",
            "Research AI SDK DevTools.",
            "# Source Evidence With URLs",
            "# Scrape Result\n- URL: https://nakafa.com/source",
            "# Web Search Results\n\n## Source 1: AI SDK\n- URL: https://ai-sdk.dev/docs",
          ],
          "\n\n"
        ),
      },
    ]);
  });
});
