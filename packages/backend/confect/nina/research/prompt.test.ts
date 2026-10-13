import { describe, expect, it } from "@effect/vitest";
import {
  nakafaWebSearch,
  webSearchSitesRule,
} from "@repo/backend/confect/nina/research/descriptions";
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
    expect(prompt).not.toContain("sourcePreference");
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

  it("asks for queries that reach an official, first-party, or primary source, and for its results when answering", () => {
    const search = researchSearchPrompt({ context, locale: "id" });
    const synthesis = researchPrompt({ context, locale: "id" });

    expect(search).toContain(
      "When the task asks for an official, first-party, or primary source, write queries that reach it and name the source in the query."
    );
    expect(synthesis).toContain(
      "When the task asks for an official, first-party, or primary source, prefer the results from that source for findings and citations."
    );
  });

  it("limits a search to a site only when the task asks for that site alone, in the same words in the search step and in the tool description", () => {
    const search = researchSearchPrompt({ context, locale: "id" });

    expect(webSearchSitesRule).toContain(
      "Put a site in the sites field only when the task asks for results from that site alone."
    );
    // A page the learner sent to read, or a source to check against others,
    // must not shut every other site out of the search.
    expect(webSearchSitesRule).toContain(
      "A site or address that the task names for another reason, such as a page to read or a source to check against others, limits nothing: leave it out of the sites field."
    );
    expect(webSearchSitesRule).toContain(
      "Put the hostname of a limiting site there, also when the task writes it as a URL, and not in the queries."
    );
    expect(webSearchSitesRule).toContain(
      "A request for an official, recent, or primary source names no site by itself."
    );
    for (const guidance of [search, nakafaWebSearch]) {
      expect(guidance).toContain(webSearchSitesRule);
      // The line it replaces let any request for given sites decide.
      expect(guidance).not.toContain("results of given sites");
    }
  });

  it("keeps a URL in a query only for a page the query is about, so no line asks for a site's URL in the queries and its hostname in the sites field at once", () => {
    const search = researchSearchPrompt({ context, locale: "id" });

    for (const guidance of [search, nakafaWebSearch]) {
      expect(guidance).toContain("the URL of a page that the query is about.");
    }
    // The old lines listed bare URLs among the strings to keep in a query, next
    // to the rule that the hostname of a site stays out of the queries.
    expect(search).not.toContain("versions, URLs");
    expect(nakafaWebSearch).not.toContain("versions and URLs");
    expect(nakafaWebSearch).not.toContain("official-source, URL");
  });

  it("never asks for a domain in the query text, and says why a site operator stays out of it", () => {
    const search = researchSearchPrompt({ context, locale: "id" });

    for (const guidance of [search, nakafaWebSearch]) {
      expect(guidance.toLowerCase()).not.toContain("domain");
      expect(guidance).not.toContain("name its site in the query");
    }
    expect(nakafaWebSearch).toContain(
      "Do not write a site: operator into a query: the search provider's news source did not honor it when measured on 12 October 2026."
    );
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
    expect(nakafaWebSearch).toContain("generic industry trend search");
    expect(nakafaWebSearch).toContain(
      "Keep task-relevant user-provided strings"
    );
    expect(nakafaWebSearch).toContain(
      "named products, APIs, libraries, and features"
    );
    expect(nakafaWebSearch).toContain(
      "write queries that reach it: include the exact name of the source."
    );
    expect(nakafaWebSearch).not.toContain("sourcePreference");
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

  it("returns the closest thing the evidence states, scoped and cited, with one limitation, instead of nothing", () => {
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
      "Always add one limitation that names the part of the task the evidence does not cover."
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

  it("still bars absence claims in a limitation", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "Limitations are process statements about this retrieval attempt."
    );
    expect(prompt).toContain("A limitation must not claim:");
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

  it("makes saying what the collected sources cover and do not state the one exception to the bans, stated after them", () => {
    const prompt = researchPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "A limitation may still say what the collected sources cover and what they do not state."
    );
    expect(prompt).toContain(
      "That is the one exception to the claims above: it describes only these sources."
    );
    expect(prompt).toContain(
      "Never widen it into a claim about the world, such as that something was not announced."
    );
    expect(
      prompt.indexOf(
        "A limitation may still say what the collected sources cover"
      )
    ).toBeGreaterThan(
      prompt.indexOf(
        "a database, corpus, search index, or exhaustive search proves anything."
      )
    );
  });
});
