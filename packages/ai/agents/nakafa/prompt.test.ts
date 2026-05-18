import { nakafaAgentPrompt } from "@repo/ai/agents/nakafa/prompt";
import { describe, expect, it } from "vitest";

const context = {
  currentDate: "May 15, 2026",
  needsPageFetch: false,
  slug: "chat",
  url: "/id/chat",
  userRole: "student",
  verified: false,
} as const;

describe("nakafaAgentPrompt", () => {
  it("keeps Nakafa routing, evidence, and output sections separate", () => {
    const prompt = nakafaAgentPrompt({ context, locale: "id" });

    const toolIndex = prompt.indexOf("# Tool Usage Guidelines");
    const evidenceIndex = prompt.indexOf("# Evidence Contract");
    const outputIndex = prompt.indexOf("# Evidence Formatting");

    expect(toolIndex).toBeGreaterThanOrEqual(0);
    expect(evidenceIndex).toBeGreaterThan(toolIndex);
    expect(outputIndex).toBeGreaterThan(evidenceIndex);

    const toolSection = prompt.slice(toolIndex, evidenceIndex);
    const evidenceSection = prompt.slice(evidenceIndex, outputIndex);
    const outputSection = prompt.slice(outputIndex);

    for (const heading of [
      "## Search",
      "## Read",
      "## Exercise",
      "## Quran",
      "## Taxonomy",
      "## Multi-tool Flow",
    ]) {
      expect(toolSection).toContain(heading);
    }

    expect(toolSection).toContain("Put all search text in queries.");
    expect(toolSection).not.toContain("Structured exercise questions");
    expect(evidenceSection).toContain(
      "Structured exercise questions, choices, answers, and explanations must come from the exercise tool result."
    );
    expect(evidenceSection).toContain(
      "Lesson-provided practice may come from read content"
    );
    expect(outputSection).toContain("Do not include public URLs");
  });

  it("keeps lesson and exercise retrieval as separate focused searches", () => {
    const prompt = nakafaAgentPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "If the task asks for both lesson explanation and practice"
    );
    expect(prompt).toContain("subject for the lesson");
    expect(prompt).toContain("exercises for the practice");
    expect(prompt).toContain("Call independent searches in parallel");
    expect(prompt).toContain("Preserve exact identifiers in queries");
    expect(prompt).toContain("warmups");
    expect(prompt).toContain("starter examples");
    expect(prompt).toContain("preparation before practice");
    expect(prompt).toContain(
      "Use taxonomy first when the request asks what Nakafa structure is available"
    );
  });

  it("includes verified context and unknown roles", () => {
    const prompt = nakafaAgentPrompt({
      context: {
        currentDate: "May 15, 2026",
        needsPageFetch: true,
        slug: "subject/high-school/10/chemistry",
        url: "/id/subject/high-school/10/chemistry",
        verified: true,
      },
      locale: "id",
    });

    expect(prompt).toContain("- verified current page: yes");
    expect(prompt).toContain("- user role: unknown");
  });

  it("keeps Nakafa sources out of model-facing prose", () => {
    const prompt = nakafaAgentPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "Return compact evidence markdown with content IDs and retrieved data."
    );
    expect(prompt).toContain(
      "Do not include public URLs, source labels, citation fields, or markdown links for Nakafa-owned content."
    );
    expect(prompt).toContain(
      "Nakafa source previews are handled outside the final prose."
    );
    expect(prompt).not.toContain("Inline citation:");
  });
});
