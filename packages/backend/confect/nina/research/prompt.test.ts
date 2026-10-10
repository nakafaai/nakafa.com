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

  it("returns the closest thing the evidence states, scoped and cited, instead of nothing", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "When the evidence does not state what the task asks but states the closest thing to it:"
    );
    expect(prompt).toContain(
      "the same event in another year, an earlier version of a rule, or the general requirement without the specific date."
    );
    expect(prompt).toContain("Return it as findings, each with its citation.");
    expect(prompt).toContain(
      "Each finding says exactly what it covers, such as its year or version, so it cannot be read as the answer to the task."
    );
    expect(prompt).toContain(
      "Add one limitation that names the part of the task the evidence does not cover."
    );
  });

  it("explains the closest-thing rule with one generic example, not a real exam", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain("Example:");
    expect(prompt.indexOf("Example:")).toBe(prompt.lastIndexOf("Example:"));
    expect(prompt.toLowerCase()).not.toContain("snbt");
    expect(prompt.toLowerCase()).not.toContain("snpmb");
  });

  it("allows an empty findings array only when no source states the task or its closest thing", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "Return an empty findings array only when no collected source states anything about the task or the closest thing to it, and then say in a limitation what this attempt could not verify."
    );
    expect(prompt).not.toContain("Empty or weak evidence");
  });

  it("lets a limitation say what the sources cover and not state, and still bars absence claims", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "Limitations are process statements about this retrieval attempt."
    );
    expect(prompt).toContain(
      "A limitation may say what the collected sources cover and what they do not state."
    );
    expect(prompt).toContain(
      "entity nonexistence for a person, school, organization, product, policy, or event."
    );
    expect(prompt).toContain(
      "information, evidence, proof, sources, announcements, or official information are available or unavailable beyond the collected sources."
    );
    expect(prompt).toContain(
      "found/not-found status, public-data absence, announcement absence, or digital-footprint absence."
    );
    expect(prompt).toContain(
      "a database, corpus, search index, or exhaustive search proves anything."
    );
    expect(prompt).not.toContain("noEvidenceAnswer");
    expect(prompt).not.toContain(
      "This retrieval run was insufficient to verify the user's claim"
    );
  });
});
