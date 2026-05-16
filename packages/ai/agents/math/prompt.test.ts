import { mathPrompt } from "@repo/ai/agents/math/prompt";
import { describe, expect, it } from "vitest";

const base = {
  context: {
    currentDate: "May 15, 2026",
    needsPageFetch: false,
    slug: "subject/high-school/11/mathematics/function-modeling/rational-function",
    url: "https://nakafa.com/id/subject/high-school/11/mathematics/function-modeling/rational-function",
    userRole: "student",
    verified: true,
  },
  locale: "id",
} as const;

describe("mathPrompt", () => {
  it("requires deterministic tool evidence before answering", () => {
    const prompt = mathPrompt(base);

    expect(prompt).toContain(
      "Always use at least one math tool before answering."
    );
    expect(prompt).toContain(
      "Never label math as verified unless a tool result says verified."
    );
    expect(prompt).toContain(
      "The first math tool must check the user's original target operation."
    );
    expect(prompt).toContain(
      "Use calculus for derivative, integral, or limit requests before any arithmetic simplification."
    );
    expect(prompt).toContain(
      "Use arithmetic only for direct numeric evaluation or for simplifying a value after the original target operation has been checked."
    );
    expect(prompt).toContain(
      "For fair dice, cards, or finite equally likely outcomes, use statistics mean or arithmetic over the listed outcomes instead of a named probability distribution."
    );
    expect(prompt).toContain(
      "If an integral has bounds, describe it as a definite integral."
    );
    expect(prompt).toContain(
      "Never say the full final result was verified when the only checked result has partial step status."
    );
    expect(prompt).toContain(
      "say that simplification was checked, not the theorem itself."
    );
    expect(prompt).toContain(
      "Teach from the checked work. Treat the math steps as a worked example for a short role-appropriate explanation."
    );
    expect(prompt).toContain(
      "Adapt explanations to the user role in the context."
    );
    expect(prompt).toContain(
      "what we are finding, why the next step is valid, and what result follows"
    );
    expect(prompt).toContain("Use the user's locale");
    expect(prompt).toContain(
      "Do not invent derivation steps that are not present in the checked work."
    );
    expect(prompt).toContain("Do not mention internal system names");
    expect(prompt).toContain("normal classroom language");
    expect(prompt).toContain("Describe the check status");
    expect(prompt).not.toContain("student-friendly");
  });

  it("routes broad math groups through deterministic math tools", () => {
    const prompt = mathPrompt(base);

    expect(prompt).toContain("equation: solving equations");
    expect(prompt).toContain("matrix: linear algebra operations");
    expect(prompt).toContain("discrete: number theory and combinatorics");
    expect(prompt).not.toContain("Math.js");
  });

  it("includes fallback context for unverified pages and unknown roles", () => {
    const prompt = mathPrompt({
      ...base,
      context: {
        ...base.context,
        userRole: undefined,
        verified: false,
      },
    });

    expect(prompt).toContain("- Verified: no");
    expect(prompt).toContain("- User Role: unknown");
  });
});
