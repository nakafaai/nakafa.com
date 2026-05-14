import { nakafaAgentPrompt } from "@repo/ai/agents/nakafa/prompt";
import { describe, expect, it } from "vitest";

const context = {
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
      "If the task asks for both lesson explanation and practice, make separate parallel focused search calls"
    );
    expect(prompt).toContain("subject for the lesson");
    expect(prompt).toContain("exercises for the practice");
    expect(prompt).toContain(
      "When independent searches are needed, call search tools in parallel"
    );
    expect(prompt).toContain(
      "Use queries only for alternate phrasings within one section."
    );
    expect(prompt).toContain(
      "For exercise requests without an exact reference, search the exercises section first, then call exercise"
    );
  });

  it("includes verified context and unknown roles", () => {
    const prompt = nakafaAgentPrompt({
      context: {
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
});
