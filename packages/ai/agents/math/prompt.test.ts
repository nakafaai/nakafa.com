import { mathPrompt } from "@repo/ai/agents/math/prompt";
import { describe, expect, it } from "vitest";

const base = {
  context: {
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
      "Do not repeat every CAS step in prose after the math evidence has rendered it."
    );
    expect(prompt).toContain("verified, contradicted, inconclusive, or error");
  });

  it("routes broad math groups through CAS tools", () => {
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
