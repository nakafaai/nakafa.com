import {
  nakafaScrape,
  nakafaWebSearch,
} from "@repo/ai/agents/research/descriptions";
import { researchPrompt } from "@repo/ai/agents/research/prompt";
import { describe, expect, it } from "vitest";

const context = {
  needsPageFetch: false,
  slug: "",
  url: "/id/chat/test",
  userRole: "student" as const,
  verified: false,
};

describe("research prompt", () => {
  it("keeps official-source requests scoped to authoritative sources", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain("Preserve source constraints");
    expect(prompt).toContain("Do not rewrite a specific source request");
    expect(prompt).toContain("Avoid YouTube, social posts, and listicles");
  });

  it("includes verified page context when available", () => {
    const prompt = researchPrompt({
      context: { ...context, userRole: undefined, verified: true },
      locale: "en",
    });

    expect(prompt).toContain("- Verified: yes");
    expect(prompt).toContain("- User Role: unknown");
  });

  it("guides search and scrape tools toward primary sources", () => {
    expect(nakafaWebSearch).toContain("official domain");
    expect(nakafaWebSearch).toContain("generic industry trend search");
    expect(nakafaWebSearch).toContain(
      "NEVER write numeric citation markers like [1] or [4, 21, 23]."
    );
    expect(nakafaScrape).toContain("selected search evidence");
    expect(nakafaScrape).toContain("primary documentation");
  });

  it("keeps Google Search grounding inside the research agent", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain("Google Search grounding");
    expect(prompt).toContain("Use webSearch to collect inspectable Firecrawl");
    expect(prompt).toContain("Use Google Search grounding when Firecrawl");
  });

  it("keeps research citations as markdown links", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "Use markdown links like [source](https://example.com) for citations."
    );
    expect(prompt).toContain(
      "Never use numeric citation markers such as [1] or [4, 21, 23]."
    );
  });

  it("keeps exact source synthesis away from search tools", () => {
    const prompt = researchPrompt({
      context,
      locale: "id",
      mode: "exact-source",
    });

    expect(prompt).toContain(
      "Exact source evidence has already been retrieved"
    );
    expect(prompt).toContain("Do not broaden exact-source requests");
    expect(prompt).toContain(
      "Cite evidence with markdown links, not numeric bracket markers"
    );
    expect(prompt).not.toContain("webSearch");
    expect(prompt).not.toContain("Google Search grounding");
  });
});
