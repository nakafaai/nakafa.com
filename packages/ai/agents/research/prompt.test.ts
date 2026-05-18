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

    expect(toolSection).toContain("Workflow:");
    expect(toolSection).toContain("Search rules:");
    expect(toolSection).toContain("webSearch");
    expect(toolSection).toContain("Google Search grounding");
    expect(toolSection).toContain(
      "Every webSearch call must set sourcePreference"
    );
    expect(toolSection).not.toContain("Do not infer absence");
    expect(evidenceSection).toContain("Do not infer absence");
    expect(outputSection).toContain(
      "Return concise internal evidence notes only."
    );
  });

  it("keeps synthesis prompt free of tool-routing language", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain("# Synthesis Rules");
    expect(prompt).not.toContain("# Tool Usage Guidelines");
    expect(prompt).not.toContain("Workflow:");
    expect(prompt).not.toContain("webSearch");
    expect(prompt).not.toContain("Google Search grounding");
  });

  it("keeps official-source requests scoped to authoritative sources", () => {
    const prompt = researchEvidencePrompt({ context, locale: "id" });

    expect(prompt).toContain("Preserve task-relevant user-provided strings");
    expect(prompt).toContain("Do not translate or paraphrase");
    expect(prompt).toContain(
      "Search named or official sources before broadening."
    );
    expect(prompt).toContain(
      "Do not rewrite a specific source request into a generic trends query."
    );
    expect(prompt).toContain("Avoid YouTube, social posts, and listicles");
  });

  it("includes runtime context with unknown role fallback", () => {
    const prompt = researchEvidencePrompt({
      context: { ...context, userRole: undefined, verified: true },
      locale: "en",
    });

    expect(prompt).toContain("- date: May 15, 2026");
    expect(prompt).toContain("- verified: yes");
    expect(prompt).toContain("- user role: unknown");
  });

  it("includes synthesis runtime context with unknown role fallback", () => {
    const prompt = researchPrompt({
      context: { ...context, userRole: undefined, verified: true },
      locale: "en",
    });

    expect(prompt).toContain("- verified: yes");
    expect(prompt).toContain("- user role: unknown");
  });

  it("guides search and scrape tools toward primary sources", () => {
    expect(nakafaWebSearch).toContain("official domain");
    expect(nakafaWebSearch).toContain("generic industry trend search");
    expect(nakafaWebSearch).toContain(
      "Keep task-relevant user-provided strings"
    );
    expect(nakafaWebSearch).toContain(
      "named products, APIs, libraries, and features"
    );
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

  it("keeps Google Search grounding inside the research evidence agent", () => {
    const prompt = researchEvidencePrompt({ context, locale: "id" });

    expect(prompt).toContain("Use webSearch for inspectable Firecrawl");
    expect(prompt).toContain(
      "Use Google Search grounding for current public corroboration after Firecrawl."
    );
  });

  it("keeps research citations structured", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "Return structured research data through the provided output schema"
    );
    expect(prompt).toContain(
      "findings[].text: one concise source-backed claim."
    );
    expect(prompt).toContain(
      "findings[].citations: source title and URL for that claim."
    );
    expect(prompt).toContain("limitations: self-contained process limitations");
    expect(prompt).toContain(
      "Do not put markdown links, numeric citation markers, or source-list prose inside finding text."
    );
  });

  it("prevents no-source answers from becoming existence claims", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "Limitations and empty-findings answers are process statements about this retrieval attempt."
    );
    expect(prompt).toContain(
      "entity nonexistence for a person, school, organization, product, policy, or event."
    );
    expect(prompt).toContain(
      "information, evidence, proof, sources, announcements, or official information are available or unavailable."
    );
    expect(prompt).toContain(
      "found/not-found status, public-data absence, announcement absence, or digital-footprint absence."
    );
    expect(prompt).not.toContain(
      "This retrieval run was insufficient to verify the user's claim"
    );
  });

  it("keeps empty evidence searches from becoming absence evidence", () => {
    const prompt = researchEvidencePrompt({ context, locale: "id" });

    expect(prompt).toContain("zero usable direct sources");
    expect(prompt).toContain("Do not infer absence");
    expect(prompt).toContain("digital-footprint absence");
  });
});
