import {
  nakafaScrape,
  nakafaWebSearch,
} from "@repo/ai/agents/research/descriptions";
import {
  researchEvidencePrompt,
  researchPrompt,
} from "@repo/ai/agents/research/prompt";
import { describe, expect, it } from "vitest";

const context = {
  currentDate: "May 15, 2026",
  needsPageFetch: false,
  slug: "",
  url: "/id/chat/test",
  userRole: "student" as const,
  verified: false,
};

describe("research prompt", () => {
  it("keeps official-source requests scoped to authoritative sources", () => {
    const prompt = researchEvidencePrompt({ context, locale: "id" });

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

  it("includes evidence context without assuming a known role", () => {
    const prompt = researchEvidencePrompt({
      context: { ...context, userRole: undefined, verified: true },
      locale: "en",
    });

    expect(prompt).toContain("- Date: May 15, 2026");
    expect(prompt).toContain("- Verified: yes");
    expect(prompt).toContain("- User Role: unknown");
  });

  it("guides search and scrape tools toward primary sources", () => {
    expect(nakafaWebSearch).toContain("official domain");
    expect(nakafaWebSearch).toContain("generic industry trend search");
    expect(nakafaWebSearch).toContain(
      "Use returned titles and URLs as citation data"
    );
    expect(nakafaWebSearch).toContain(
      "Keep source titles and URLs separate from finding prose."
    );
    expect(nakafaScrape).toContain("selected search evidence");
    expect(nakafaScrape).toContain("primary documentation");
  });

  it("keeps Google Search grounding inside the research agent", () => {
    const prompt = researchEvidencePrompt({ context, locale: "id" });

    expect(prompt).toContain("Google Search grounding");
    expect(prompt).toContain("Use webSearch to collect inspectable Firecrawl");
    expect(prompt).toContain("Use Google Search grounding for current public");
  });

  it("keeps research citations structured", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "Return structured research data through the provided output schema"
    );
    expect(prompt).toContain("findings[].text contains one concise");
    expect(prompt).toContain("findings[].citations contains the source");
    expect(prompt).toContain("Do not put markdown links");
  });

  it("keeps source constraints while search tools stay available", () => {
    const prompt = researchEvidencePrompt({ context, locale: "id" });

    expect(prompt).toContain("Use scrape when a selected search source");
    expect(prompt).toContain("Preserve source constraints");
    expect(prompt).toContain("webSearch");
    expect(prompt).toContain("Google Search grounding");
  });

  it("keeps synthesis isolated from tool routing", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain("Use only the provided research evidence");
    expect(prompt).toContain("Do not invent sources");
    expect(prompt).not.toContain("webSearch");
    expect(prompt).not.toContain("Google Search grounding");
  });
});
