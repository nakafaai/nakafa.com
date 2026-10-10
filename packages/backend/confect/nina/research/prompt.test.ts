import { describe, expect, it } from "@effect/vitest";
import { nakafaWebSearch } from "@repo/backend/confect/nina/research/descriptions";
import {
  researchPrompt,
  researchSearchPrompt,
} from "@repo/backend/confect/nina/research/prompt";

const context = {
  currentDate: "May 15, 2026",
  slug: "",
  url: "/id/chat/test",
  userRole: "student" as const,
  verified: false,
};

describe("research prompt", () => {
  it("asks the search step for one search and nothing else", () => {
    const prompt = researchSearchPrompt({ context, locale: "id" });

    expect(prompt).toContain("# Tool Usage Guidelines");
    expect(prompt).toContain(
      "Call webSearch once with every query the task needs."
    );
    expect(prompt).toContain("Search rules:");
    expect(prompt).toContain("Every webSearch call must set sourcePreference");
    expect(prompt).not.toContain("evidence notes");
    expect(prompt).not.toContain("# Evidence Output");
  });

  it("keeps synthesis prompt free of tool-routing language", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain("# Synthesis Rules");
    expect(prompt).not.toContain("# Tool Usage Guidelines");
    expect(prompt).not.toContain("Workflow:");
    expect(prompt).not.toContain("webSearch");
  });

  it("keeps official-source requests scoped to authoritative sources", () => {
    const prompt = researchSearchPrompt({ context, locale: "id" });

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
    const prompt = researchSearchPrompt({
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

  it("guides search toward primary sources", () => {
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
      "Limitations are process statements about this retrieval attempt."
    );
    expect(prompt).toContain(
      "Empty or weak evidence is a process limitation only: return an empty findings array."
    );
    expect(prompt).not.toContain("noEvidenceAnswer");
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
});
