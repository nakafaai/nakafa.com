import { mathPrompt } from "@repo/ai/agents/math/prompt";
import { mathOperations } from "@repo/math/schema/operations";
import { describe, expect, it } from "vitest";

const base = {
  context: {
    currentDate: "May 15, 2026",
    needsPageFetch: false,
    slug: "materi/matematika/integral/jumlahan-riemann",
    url: "https://nakafa.com/id/materi/matematika/integral/jumlahan-riemann",
    userRole: "student",
    verified: true,
  },
  locale: "id",
} as const;

describe("mathPrompt", () => {
  it("keeps routing, verification, and output rules separate", () => {
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
      "Arithmetic:",
      "Algebra:",
      "Equation:",
      "Calculus:",
      "Series:",
      "Matrix:",
      "Statistics:",
      "Probability:",
      "Geometry:",
      "Discrete:",
    ]) {
      expect(toolSection).toContain(heading);
    }

    expect(toolSection).toContain("interval_probability");
    expect(toolSection).toContain("already-substituted function values");
    expect(toolSection).toContain(
      "Named-distribution moments are probability targets"
    );
    expect(toolSection).toContain(
      "Check each requested named-distribution moment with probability"
    );
    expect(toolSection).toContain(
      "Derivations must name the definition, moment identity, recurrence, or variance identity"
    );
    expect(toolSection).toContain(
      "keep variable as the underlying random variable name"
    );
    expect(toolSection).toContain(
      "put the requested transformed target in expression"
    );
    expect(toolSection).toContain(
      "The transformed expression must contain only that same random variable."
    );
    expect(toolSection).not.toContain("E[X^4]");
    expect(toolSection).not.toContain("Var(X^2)");
    expect(toolSection).toContain(
      "Do not use calculus to replace probability checks"
    );
    expect(toolSection).toContain("For optimization or extrema, differentiate");
    expect(toolSection).toContain(
      "use arithmetic evaluate on the original expression after substituting"
    );
    expect(toolSection).toContain("minimum point and maximum point requests");
    expect(toolSection).toContain("Fill display.title and display.description");
    expect(toolSection).toContain("Use inline math delimiters");
    expect(toolSection).toContain(
      "For coordinate-system artifact, plot, graph, visualize, or render requests, call the matching geometry operation first."
    );
    expect(toolSection).toContain(
      "For a line through two points, use line as the first check"
    );
    expect(toolSection).toContain(
      "Do not start coordinate visualization requests with simplify, solve, evaluate, or chart-like prose."
    );
    expect(toolSection).not.toContain("Never label math as verified");
    expect(verificationSection).toContain("Never label math as verified");
    expect(verificationSection).not.toContain(
      "Do not mention internal system names"
    );
    expect(outputSection).toContain("Do not mention internal system names");
    expect(outputSection).toContain(
      "Return concise markdown in the user's locale"
    );
    expect(outputSection).toContain(
      "indent the \\[...\\] block under that list item"
    );
  });

  it("requires deterministic evidence before answering", () => {
    const prompt = mathPrompt(base);

    expect(prompt).toContain(
      "Always use at least one math tool before answering."
    );
    expect(prompt).toContain(
      "The first tool must check the user's original target operation"
    );
    expect(prompt).toContain("not a guessed final answer");
    expect(prompt).toContain("Natural wording such as");
    expect(prompt).toContain("Call tools for each distinct calculation");
    expect(prompt).toContain("If evidence is missing and can be checked");
    expect(prompt).toContain(
      "the evidence is incomplete until the substituted original expression is checked"
    );
    expect(prompt).toContain(
      "For error status, do not present the requested result as checked or proven."
    );
    expect(prompt).toContain("For partial step status");
    expect(prompt).toContain(
      "separate theorem-based reasoning from checked evidence"
    );
    expect(prompt).toContain(
      "retry the original operation with corrected input before answering"
    );
    expect(prompt).toContain(
      "compare the failed input with the original task for omitted variables"
    );
    expect(prompt).toContain(
      "include the conceptual bridge between evidence and conclusion"
    );
    expect(prompt).toContain('Avoid contextless labels such as "given"');
    expect(prompt).toContain(
      "Do not say the user provided a formula, method, or calculation"
    );
  });

  it("routes broad math domains through supported deterministic operations", () => {
    const prompt = mathPrompt(base);

    expect(prompt).toContain("solve: equations, systems, and inequalities.");
    expect(prompt).toContain("roots: polynomial roots.");
    expect(prompt).toContain("Include lower, upper, and inclusivity fields");
    expect(prompt).toContain("Use solve instead of roots");
    expect(prompt).toContain(
      "set variable to the bounded variable and variables to all solved variables"
    );
    expect(prompt).toContain(
      "Use separate calls when a request asks for both expansion and closed-form sum or product."
    );
    expect(prompt).toContain("eigen_analysis");
    expect(prompt).toContain("Jordan-related conclusions");
    expect(prompt).toContain("z_score");
    expect(prompt).toContain("For fair dice, cards");
    expect(prompt).toContain("For two point-defined line intersections");
    expect(prompt).toContain(
      "gcd, lcm, is_prime, prime_factorization, modular, permutation, combination."
    );
    expect(prompt).not.toContain("Math.js");
  });

  it("keeps tool routing vocabulary aligned with math operation schemas", () => {
    const prompt = mathPrompt(base);
    const toolIndex = prompt.indexOf("# Tool Usage Guidelines");
    const verificationIndex = prompt.indexOf("# Verification Rules");
    const toolSection = prompt.slice(toolIndex, verificationIndex);

    for (const operation of mathOperations) {
      expect(toolSection).toContain(operation);
    }
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

    expect(prompt).toContain("- verified: no");
    expect(prompt).toContain("- user role: unknown");
  });
});
