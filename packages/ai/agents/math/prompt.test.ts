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
  it("keeps math tool routing separate from verification and output rules", () => {
    const prompt = mathPrompt(base);

    const toolIndex = prompt.indexOf("# Tool Usage Guidelines");
    const verificationIndex = prompt.indexOf("# Verification Rules");
    const outputIndex = prompt.indexOf("# Output Formatting");

    expect(toolIndex).toBeGreaterThanOrEqual(0);
    expect(verificationIndex).toBeGreaterThan(toolIndex);
    expect(outputIndex).toBeGreaterThan(verificationIndex);

    const toolSection = prompt.slice(toolIndex, verificationIndex);
    const verificationSection = prompt.slice(verificationIndex, outputIndex);
    const outputSection = prompt.slice(outputIndex);

    for (const heading of [
      "## Arithmetic",
      "## Algebra",
      "## Equation",
      "## Calculus",
      "## Series",
      "## Matrix",
      "## Statistics",
      "## Probability",
      "## Geometry",
      "## Discrete",
    ]) {
      expect(toolSection).toContain(heading);
    }

    expect(toolSection).toContain(
      "For named probability distributions such as normal, binomial, or poisson, use probability for the original event."
    );
    expect(toolSection).not.toContain("Never label math as verified");
    expect(verificationSection).toContain("Never label math as verified");
    expect(verificationSection).not.toContain(
      "Do not mention internal system names"
    );
    expect(outputSection).toContain("Do not mention internal system names");
    expect(outputSection).toContain("Use the user's locale");
  });

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
      "For named probability distributions such as normal, binomial, or poisson, use probability for the original event."
    );
    expect(prompt).toContain("tail_probability for above or at-least");
    expect(prompt).toContain("call probability once");
    expect(prompt).toContain("operation interval_probability");
    expect(prompt).not.toContain("probabilityInterval");
    expect(prompt).not.toContain("probabilityTail");
    expect(prompt).not.toContain("probabilitySummary");
    expect(prompt).toContain(
      "Use arithmetic only for direct numeric evaluation or for simplifying a value after the original target operation has been checked."
    );
    expect(prompt).toContain(
      "For fair dice, cards, or finite equally likely outcomes, use statistics mean or arithmetic over the listed outcomes instead of a named probability distribution."
    );
    expect(prompt).toContain(
      "If an integral has bounds, include lower and upper in the calculus input"
    );
    expect(prompt).toContain(
      "If a math check returns error and the recovery guidance identifies a correctable input issue"
    );
    expect(prompt).toContain(
      "If the checked work has status error, do not present the requested result as checked or proven."
    );
    expect(prompt).toContain(
      "Never say the full final result was verified when the only checked result has partial step status."
    );
    expect(prompt).toContain(
      "explicitly separate that theorem-based claim from the failed check."
    );
    expect(prompt).toContain(
      "For partial step status, say the computed value was checked"
    );
    expect(prompt).toContain(
      'Reserve words equivalent to "fully verified" for complete step status only.'
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
    expect(prompt).toContain("do not imply the user already used steps");
    expect(prompt).toContain("Use the user's locale");
    expect(prompt).toContain(
      "Do not invent derivation steps that are not present in the checked work."
    );
    expect(prompt).toContain("Do not mention internal system names");
    expect(prompt).toContain("Do not say a tool, helper, backend, or system");
    expect(prompt).toContain("normal classroom language");
    expect(prompt).toContain("Describe the check status");
    expect(prompt).not.toContain("student-friendly");
  });

  it("routes broad math groups through deterministic math tools", () => {
    const prompt = mathPrompt(base);

    expect(prompt).toContain("## Equation");
    expect(prompt).toContain("Use equation for solving equations");
    expect(prompt).toContain("## Matrix");
    expect(prompt).toContain("Use matrix for linear algebra operations");
    expect(prompt).toContain("## Discrete");
    expect(prompt).toContain(
      "Use discrete for number theory and combinatorics"
    );
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
