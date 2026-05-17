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
  it("keeps evidence tool routing under tool usage guidelines", () => {
    const prompt = researchEvidencePrompt({ context, locale: "id" });

    const toolIndex = prompt.indexOf("# Tool Usage Guidelines");
    const evidenceIndex = prompt.indexOf("# Evidence Collection Contract");
    const outputIndex = prompt.indexOf("# Evidence Output");

    expect(toolIndex).toBeGreaterThanOrEqual(0);
    expect(evidenceIndex).toBeGreaterThan(toolIndex);
    expect(outputIndex).toBeGreaterThan(evidenceIndex);

    const toolSection = prompt.slice(toolIndex, evidenceIndex);
    const evidenceSection = prompt.slice(evidenceIndex, outputIndex);
    const outputSection = prompt.slice(outputIndex);

    expect(toolSection).toContain("## Workflow");
    expect(toolSection).toContain("## Search Rules");
    expect(toolSection).toContain("webSearch");
    expect(toolSection).toContain("Google Search grounding");
    expect(toolSection).toContain(
      "Every webSearch call must set sourcePreference"
    );
    expect(toolSection).not.toContain("Return ONLY internal evidence notes");
    expect(evidenceSection).toContain("Return ONLY internal evidence notes");
    expect(outputSection).toContain(
      "Return concise internal evidence notes only."
    );
  });

  it("keeps synthesis prompt free of tool-routing language", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain("# Synthesis Rules");
    expect(prompt).not.toContain("# Tool Usage Guidelines");
    expect(prompt).not.toContain("## Workflow");
    expect(prompt).not.toContain("## Search Rules");
    expect(prompt).not.toContain("webSearch");
    expect(prompt).not.toContain("Google Search grounding");
    expect(prompt).not.toContain("Grounding Source References");
  });

  it("keeps official-source requests scoped to authoritative sources", () => {
    const prompt = researchEvidencePrompt({ context, locale: "id" });

    expect(prompt).toContain("Preserve source constraints");
    expect(prompt).toContain("Do not rewrite a specific source request");
    expect(prompt).toContain("Avoid YouTube, social posts, and listicles");
    expect(prompt).toContain("Keep exact user wording for named products");
    expect(prompt).toContain("Do not translate or paraphrase those terms.");
    expect(prompt).toContain("Every webSearch call must set sourcePreference");
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
    expect(nakafaWebSearch).toContain("Keep exact named products");
    expect(nakafaWebSearch).toContain("Always set sourcePreference");
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
    expect(prompt).not.toContain("Grounding Source References");
  });
});
