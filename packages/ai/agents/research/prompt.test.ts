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
    expect(nakafaScrape).toContain("official source");
    expect(nakafaScrape).toContain("primary documentation");
  });

  it("keeps Google Search grounding inside the research agent", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain("Google Search grounding");
    expect(prompt).toContain("Use Google Search grounding or webSearch");
  });
});
