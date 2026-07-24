import type { SyncedTryoutSection } from "@repo/backend/convex/contentSync/tryouts/spec";
import {
  chunkTryoutRows,
  type TryoutSyncArgs,
} from "@repo/backend/scripts/sync-content/tryout/batch";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const emptyRows: TryoutSyncArgs = {
  countries: [],
  exams: [],
  questionSets: [],
  questions: [],
  routes: [],
  sections: [],
  sets: [],
  tracks: [],
};

describe("sync-content/tryout/batch", () => {
  it("returns no mutation batches for an empty projection", () => {
    expect(Effect.runSync(chunkTryoutRows(emptyRows))).toEqual([]);
  });

  it("keeps a stable set whole when the next group crosses row 50", () => {
    const rows = {
      ...emptyRows,
      sections: [...createSections("set-1", 49), ...createSections("set-2", 2)],
    };

    const batches = Effect.runSync(chunkTryoutRows(rows));

    expect(batches.map(({ sections }) => sections.length)).toEqual([49, 2]);
    expect(
      batches.map(({ sections }) => [
        ...new Set(sections.map(({ setKey }) => setKey)),
      ])
    ).toEqual([["set-1"], ["set-2"]]);
  });

  it("fails with set identity when one set exceeds the mutation limit", () => {
    const error = Effect.runSync(
      Effect.flip(
        chunkTryoutRows({
          ...emptyRows,
          sections: createSections("set-overflow", 51),
        })
      )
    );

    expect(error).toMatchObject({
      _tag: "TryoutSectionBatchOverflowError",
      limit: 50,
      sectionCount: 51,
      setIdentity: expect.stringContaining("set-overflow"),
    });
  });
});

/** Builds one complete stable-set group for batch boundary tests. */
function createSections(setKey: string, count: number): SyncedTryoutSection[] {
  return Array.from({ length: count }, (_, index) => ({
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    order: index + 1,
    publicPath: `try-out/indonesia/snbt/2027/${setKey}/section-${index + 1}`,
    questionCount: 1,
    questionSourcePath: `question-bank/tryout/indonesia/snbt/section-${index + 1}/${setKey}`,
    sectionKey: `section-${index + 1}`,
    setKey,
    sourceRevision: "2026",
    timeLimitSeconds: 90,
    title: `Section ${index + 1}`,
    trackKey: "2027",
    visibility: "visible",
  }));
}
