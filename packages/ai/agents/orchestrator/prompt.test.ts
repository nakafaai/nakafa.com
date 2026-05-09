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
