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
  it("keeps lesson and exercise retrieval as separate focused searches", () => {
    const prompt = nakafaAgentPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "If the request asks for both lesson explanation and practice, make separate parallel focused search calls"
    );
    expect(prompt).toContain("subject for the lesson");
    expect(prompt).toContain("exercises for the practice");
    expect(prompt).toContain(
      "When independent searches are needed, call search tools in parallel"
    );
    expect(prompt).toContain("Put all search text in queries.");
    expect(prompt).toContain(
      "For every search, preserve exact identifiers from the request in queries"
    );
    expect(prompt).toContain(
      "For exercise requests without an exact reference, search the exercises section first, then call exercise"
    );
    expect(prompt).toContain(
      "Use taxonomy first when the request asks what Nakafa sections, filters, categories, materials, grades, tools, or exercise paths are available."
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

    expect(prompt).toContain("Verified current page: yes");
    expect(prompt).toContain("User role: unknown");
  });

  it("keeps Nakafa sources out of model-facing prose", () => {
    const prompt = nakafaAgentPrompt({ context, locale: "id" });

    expect(prompt).toContain(
      "Return compact evidence markdown with content IDs and the retrieved data."
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
