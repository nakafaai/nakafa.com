import {
  prepareAnswerFromNakafaEvidenceStep,
  prepareReadStep,
  prepareTaxonomyAnswerStep,
  readSearchFollowup,
  shouldAnswerFromNakafaEvidence,
  shouldReadAfterSearch,
} from "@repo/ai/agents/nakafa/step";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import type { NakafaAgentSection } from "@repo/contents/_lib/agent/schema/ref";
import type { NakafaAgentSearchResult } from "@repo/contents/_lib/agent/schema/search";
import type { Locale } from "@repo/contents/_types/content";
import { describe, expect, it } from "vitest";

/** Builds a typed Nakafa search item fixture from canonical route parts. */
function contentSummary({
  description,
  excerpt,
  locale,
  route,
  section,
  title,
}: {
  description: string;
  excerpt?: string;
  locale: Locale;
  route: string;
  section: NakafaAgentSection;
  title: string;
}) {
  return {
    ...readNakafaContentRefFixture(locale, route, section),
    description,
    excerpt: excerpt ?? description,
    title,
  } satisfies NakafaAgentSearchResult["items"][number];
}

const subjectResult = {
  count: 1,
  has_more: false,
  items: [
    contentSummary({
      description: "Pelajari fungsi rasional.",
      locale: "id",
      route: "material/lesson/mathematics/function-modeling/rational-function",
      section: "material",
      title: "Fungsi Rasional",
    }),
  ],
  limit: 1,
  offset: 0,
} satisfies NakafaAgentSearchResult;

describe("Nakafa agent step state", () => {
  it("requires full content reads after lesson search results", () => {
    const shouldReadSubject = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: ["fungsi rasional"],
        section: "material",
      },
      subjectResult
    );
    const shouldReadBroad = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: ["fungsi rasional"],
      },
      subjectResult
    );

    expect(shouldReadSubject).toBe(true);
    expect(shouldReadBroad).toBe(true);
  });

  it("does not require content reads for quran, empty, or failed searches", () => {
    const quranSearch = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: ["al fatihah"],
        section: "quran",
      },
      {
        ...subjectResult,
        items: [
          contentSummary({
            description: "Surah pembuka.",
            locale: "id",
            route: "quran/1",
            section: "quran",
            title: "Al-Fatihah",
          }),
        ],
      }
    );
    const emptySearch = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: ["tidak ada"],
        section: "material",
      },
      {
        ...subjectResult,
        count: 0,
        items: [],
      }
    );
    const failedSearch = shouldReadAfterSearch(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: ["tidak ada"],
        section: "material",
      },
      null
    );

    expect(quranSearch).toBe(false);
    expect(emptySearch).toBe(false);
    expect(failedSearch).toBe(false);
  });

  it("returns only active read follow-up state after search", () => {
    const followup = readSearchFollowup(
      {
        limit: 1,
        locale: "id",
        offset: 0,
        queries: ["fungsi rasional"],
        section: "material",
      },
      subjectResult
    );

    expect(followup).toEqual({ shouldReadContent: true });
  });

  it("forces read for one step when content search evidence is pending", () => {
    const step = prepareReadStep(
      true,
      [{ role: "user", content: "jelaskan fungsi rasional" }],
      false
    );

    if (!step) {
      throw new Error("Expected a forced read step.");
    }

    expect(step.activeTools).toEqual(["read"]);
    expect(step.toolChoice).toEqual({ toolName: "read", type: "tool" });
    expect(step.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Call the read tool now"),
        role: "user",
      })
    );
  });

  it("does not force read when there is no pending content or read already ran", () => {
    const messages = [
      { role: "user", content: "jelaskan fungsi rasional" },
    ] satisfies Parameters<typeof prepareReadStep>[1];
    const missingContent = prepareReadStep(false, messages, false);
    const alreadyRan = prepareReadStep(true, messages, true);

    expect(missingContent).toBeUndefined();
    expect(alreadyRan).toBeUndefined();
  });

  it("turns off tools after repeated content search calls", () => {
    const steps = [
      { toolCalls: [{ toolName: "search" }] },
      { toolCalls: [{ toolName: "taxonomy" }] },
      { toolCalls: [{ toolName: "search" }] },
      { toolCalls: [{ toolName: "search" }] },
      { toolCalls: [{ toolName: "search" }] },
    ];

    const answerStep = prepareAnswerFromNakafaEvidenceStep(
      [{ role: "user", content: "cari materi fungsi rasional" }],
      steps
    );

    if (!answerStep) {
      throw new Error("Expected a final answer step.");
    }

    expect(shouldAnswerFromNakafaEvidence(steps)).toBe(true);
    expect(answerStep.toolChoice).toBe("none");
    expect(answerStep.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Do not call another Nakafa tool"),
        role: "user",
      })
    );
  });

  it("keeps tools available while discovery is still below the loop guard", () => {
    const answerStep = prepareAnswerFromNakafaEvidenceStep(
      [{ role: "user", content: "cari materi fungsi rasional" }],
      [
        { toolCalls: [{ toolName: "search" }] },
        { toolCalls: [{ toolName: "taxonomy" }] },
        { toolCalls: [{ toolName: "search" }] },
      ]
    );

    expect(answerStep).toBeUndefined();
  });

  it("turns off tools after taxonomy-only evidence is available", () => {
    const step = prepareTaxonomyAnswerStep(
      [{ role: "user", content: "struktur try out yang tersedia" }],
      [{ toolCalls: [{ toolName: "taxonomy" }] }]
    );

    if (!step) {
      throw new Error("Expected a taxonomy answer step.");
    }

    expect(step.toolChoice).toBe("none");
    expect(step.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Use the Nakafa taxonomy result"),
        role: "user",
      })
    );
  });

  it("keeps tools available when taxonomy is not the only evidence", () => {
    const step = prepareTaxonomyAnswerStep(
      [{ role: "user", content: "cari try out snbt" }],
      [{ toolCalls: [{ toolName: "taxonomy" }, { toolName: "search" }] }]
    );

    expect(step).toBeUndefined();
  });

  it("keeps tools available when no taxonomy evidence exists", () => {
    const step = prepareTaxonomyAnswerStep(
      [{ role: "user", content: "cari try out snbt" }],
      [{ toolCalls: [{ toolName: "search" }] }]
    );

    expect(step).toBeUndefined();
  });
});
