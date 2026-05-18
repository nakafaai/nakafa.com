import { mathPrompt } from "@repo/ai/agents/math/prompt";
import { mathOperations } from "@repo/math/schema/operations";
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
    expect(prompt).toContain("Before answering a multi-part request:");
    expect(prompt).toContain(
      "Compare the requested calculations with the returned math evidence."
    );
    expect(prompt).toContain("call the missing tool before answering");
    expect(prompt).toContain(
      "For named probability distributions such as normal, binomial, or poisson, use probability for the original event."
    );
    expect(prompt).toContain("tail_probability for above or at-least");
    expect(prompt).toContain("Call probability once");
    expect(prompt).toContain("operation interval_probability");
    expect(prompt).not.toContain("probabilityInterval");
    expect(prompt).not.toContain("probabilityTail");
    expect(prompt).not.toContain("probabilitySummary");
    expect(prompt).toContain("Use arithmetic for:");
    expect(prompt).toContain("evaluate on exact numeric expressions.");
    expect(prompt).toContain(
      "Do not use arithmetic instead of symbolic, statistical, probability, calculus, or discrete checks."
    );
    expect(prompt).toContain(
      "For fair dice, cards, or finite equally likely outcomes:"
    );
    expect(prompt).toContain(
      "Use statistics or arithmetic over the listed outcomes."
    );
    expect(prompt).toContain("Do not use a named probability distribution.");
    expect(prompt).toContain("If an integral has bounds:");
    expect(prompt).toContain("Include lower and upper.");
    expect(prompt).toContain("Describe it as a definite integral.");
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
      "When a theorem or definition supplies an answer after an error result:"
    );
    expect(prompt).toContain(
      "Explicitly separate that theorem-based claim from the failed check."
    );
    expect(prompt).toContain("For partial step status:");
    expect(prompt).toContain("Say the computed value was checked.");
    expect(prompt).toContain(
      'Reserve words equivalent to "fully verified" for complete step status only.'
    );
    expect(prompt).toContain(
      "When a later tool checks only simplification after a theorem:"
    );
    expect(prompt).toContain("Say that simplification was checked.");
    expect(prompt).toContain("Do not say the theorem itself was checked.");
    expect(prompt).toContain(
      "Teach from the checked work. Treat the math steps as a worked example for a short role-appropriate explanation."
    );
    expect(prompt).toContain(
      "Adapt explanations to the user role in the context."
    );
    expect(prompt).toContain("what we are finding.");
    expect(prompt).toContain("why the next step is valid.");
    expect(prompt).toContain("what result follows.");
    expect(prompt).toContain("Do not imply the user already used steps");
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
    expect(prompt).toContain("Use equation for solve on equations");
    expect(prompt).toContain(
      "Use roots when the user asks for polynomial roots"
    );
    expect(prompt).toContain("Send systems as expressions");
    expect(prompt).toContain("Use summation for finite or symbolic sums");
    expect(prompt).toContain(
      "A request containing both an expansion and a closed-form sum or product needs separate tool calls."
    );
    expect(prompt).toContain("## Matrix");
    expect(prompt).toContain("Use matrix for:");
    expect(prompt).toContain("determinant, inverse, rank, and rref.");
    expect(prompt).toContain("Use eigen_analysis for:");
    expect(prompt).toContain("eigenspaces.");
    expect(prompt).toContain("Use eigenvalues only when the user asks only");
    expect(prompt).toContain("Use matrix_multiply only when");
    expect(prompt).toContain("Use statistics for mean, median, mode");
    expect(prompt).toContain("For z_score, also include the target expression");
    expect(prompt).toContain("For the intersection of two point-defined lines");
    expect(prompt).toContain("Do not state a full Jordan block structure");
    expect(prompt).toContain("## Discrete");
    expect(prompt).toContain(
      "Use discrete for gcd, lcm, is_prime, prime_factorization, modular, permutation, and combination."
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

    expect(prompt).toContain("- Verified: no");
    expect(prompt).toContain("- User Role: unknown");
  });
});
