import { nakafaPrompt } from "@repo/ai/agents/orchestrator/prompt";
import { describe, expect, it } from "vitest";

const base = {
  currentDate: "May 9, 2026",
  currentPage: {
    locale: "id",
    slug: "subject/high-school/11/mathematics/function-modeling/rational-function",
    verified: true,
  },
  url: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function",
  userLocation: {
    city: "Berlin",
    country: "Germany",
    countryRegion: "Berlin",
    latitude: "52.52",
    longitude: "13.405",
  },
} as const;

describe("nakafaPrompt", () => {
  it("requires markdown bullets for multiple-choice options", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain(
      "Multiple-choice options MUST be formatted as one markdown bullet per option:"
    );
    expect(prompt).toContain("- A. Option text");
    expect(prompt).toContain("- E. Option text");
    expect(prompt).toContain(
      "NEVER write multiple-choice options inline in one paragraph."
    );
    expect(prompt).toContain(
      "NEVER rely on raw line breaks without bullet markers for multiple-choice options."
    );
  });

  it("keeps one stable Nina persona without conflicting harsh-advisor rules", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain(
      "Be friendly, direct, source-grounded, concise, and age-appropriate."
    );
    expect(prompt).not.toContain("brutally honest");
    expect(prompt).not.toContain("DON'T soften the truth");
    expect(prompt).not.toContain("Hold nothing back");
  });

  it("routes math requests through deterministic math evidence", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain("Use for math that needs deterministic evidence.");
    expect(prompt).toContain(
      "It can handle arithmetic, algebra, equations, inequalities, calculus, series, matrices, statistics, probability, geometry, and discrete math."
    );
    expect(prompt).toContain(
      "If deterministic math is inconclusive, explain the limitation clearly."
    );
  });

  it("teaches Nina to combine specialized agents when evidence spans domains", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain(
      "Ground every factual educational answer in the smallest reliable evidence path before the final answer"
    );
    expect(prompt).toContain(
      "Answer directly only for greetings, preferences, simple rewrites, or other requests that do not need factual, source-specific, current, or mathematical evidence."
    );
    expect(prompt).toContain(
      "Use more than one specialized agent when the answer needs more than one kind of evidence."
    );
    expect(prompt).toContain(
      "Every specialized agent task MUST be one concise Markdown brief"
    );
    expect(prompt).toContain("# User Request");
    expect(prompt).toContain("# Task");
    expect(prompt).toContain(
      "Do not split the same meaning across separate parameters."
    );
    expect(prompt).toContain(
      "Use math after Nakafa when retrieved content includes calculations, formulas, answers, or equivalence checks that need deterministic verification."
    );
    expect(prompt).toContain(
      'Use Nakafa first for named educational topics, lesson explanations, study requests, and practice requests, even when the user does not explicitly say "Nakafa".'
    );
    expect(prompt).toContain(
      "Preserve every requested deliverable in the Nakafa request."
    );
    expect(prompt).toContain(
      "Use Nakafa first when the user asks to learn, explain, summarize, practice, or get exercises for a school or university topic."
    );
    expect(prompt).toContain(
      "When specialized agents are independent, call them in parallel in the same step instead of waiting for one result before starting another."
    );
    expect(prompt).toContain(
      "Use math after deepResearch when researched numbers or claims need calculation, comparison, statistics, or verification."
    );
    expect(prompt).toContain(
      "Never invent source-specific content, current facts, exercise choices, citations, or verified math without the relevant evidence."
    );
    expect(prompt).toContain(
      "If the user asks for one product, domain, document, or official source, keep that section scoped to the requested source"
    );
    expect(prompt).toContain(
      "Use deepResearch before answering any request for official documentation, source-backed claims, citations, external links, current or latest information, or named products outside Nakafa."
    );
    expect(prompt).toContain(
      "Preserve the user's exact wording for named products, APIs, libraries, features, versions, domains, URLs, source constraints, and document titles."
    );
    expect(prompt).toContain(
      "Do not summarize away source-ownership constraints."
    );
    expect(prompt).toContain(
      "If a specialist agent returns an error, do not call the same specialist again with the same request."
    );
    expect(prompt).toContain("This applies in every user language.");
  });

  it("requires dollar-delimited evidence math to be rewritten for final answers", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain(
      "When retrieved evidence contains $...$ or $$...$$ math, rewrite it to"
    );
  });

  it("keeps external research citations without exposing Nakafa links", () => {
    const prompt = nakafaPrompt({
      ...base,
      userRole: "student",
    });

    expect(prompt).toContain(
      "Cite external research sources inline in the exact sentence they support."
    );
    expect(prompt).toContain(
      "When research evidence contains markdown links, preserve those links in the final answer"
    );
    expect(prompt).toContain(
      "Do not add product homepages, documentation links, or source links from memory."
    );
    expect(prompt).toContain(
      "preserve them exactly. Do not add parent objects, flags, wrappers, or options that are not present in the evidence."
    );
    expect(prompt).toContain(
      "Do not add Nakafa source labels, Nakafa domain links, or citation-style links for Nakafa-owned content."
    );
    expect(prompt).toContain(
      "Never show numeric citation markers such as [1] or [4, 21, 23] to users."
    );
    expect(prompt).toContain(
      "Convert any research citation indexes into markdown links using the cited source URLs."
    );
    expect(prompt).toContain(
      "Never append a final source, reference, citation, or bibliography section in any language."
    );
  });

  it.each([
    "teacher",
    "student",
    "parent",
    "administrator",
  ] as const)("includes role guidance for %s", (userRole) => {
    expect(
      nakafaPrompt({
        ...base,
        userRole,
      })
    ).toContain("User is");
  });

  it("includes default role guidance when the role is unknown", () => {
    expect(nakafaPrompt(base)).toContain("User identity is unknown.");
  });

  it("marks unverified current pages in the prompt context", () => {
    expect(
      nakafaPrompt({
        ...base,
        currentPage: {
          ...base.currentPage,
          verified: false,
        },
      })
    ).toContain("verified: no");
  });
});
