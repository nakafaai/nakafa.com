import type { WebSearchOutput } from "@repo/ai/agents/research/schema";
import {
  prepareScrapeStep,
  prepareWebSearchStep,
  selectScrapeUrl,
} from "@repo/ai/agents/research/step";
import { Option } from "effect";
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
  it("selects the first ranked source URL from web search output", () => {
    const url = selectScrapeUrl(searchOutput);

    if (Option.isNone(url)) {
      throw new Error("Expected a scrape URL.");
    }

    expect(url.value).toBe(firstSource.url);
  });

  it("does not select an empty source URL", () => {
    const url = selectScrapeUrl({
      sources: [
        {
          citation: "",
          content: "",
          description: "",
          title: "",
          url: "",
        },
      ],
    });

    expect(Option.isNone(url)).toBe(true);
  });

  it("forces scrape for one step when a source URL is pending", () => {
    const step = prepareScrapeStep(
      Option.some(firstSource.url),
      [
        { role: "user", content: "research latest climate data" },
      ] satisfies Parameters<typeof prepareScrapeStep>[1],
      false
    );

    if (!step) {
      throw new Error("Expected a forced scrape step.");
    }

    expect(step.activeTools).toEqual(["scrape"]);
    expect(step.toolChoice).toEqual({ toolName: "scrape", type: "tool" });
    expect(step.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining(firstSource.url),
        role: "user",
      })
    );
  });

  it("does not force scrape when there is no URL or scrape already ran", () => {
    const messages = [
      { role: "user", content: "research latest climate data" },
    ] satisfies Parameters<typeof prepareScrapeStep>[1];
    const missingUrl = prepareScrapeStep(Option.none(), messages, false);
    const alreadyRan = prepareScrapeStep(
      Option.some(firstSource.url),
      messages,
      true
    );

    expect(missingUrl).toBeUndefined();
    expect(alreadyRan).toBeUndefined();
  });

  it("starts with inspectable web search before provider-only grounding", () => {
    const step = prepareWebSearchStep(false);

    expect(step).toEqual({
      activeTools: ["webSearch"],
      toolChoice: { toolName: "webSearch", type: "tool" },
    });
    expect(prepareWebSearchStep(true)).toBeUndefined();
  });
});
