import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import { verify } from "@repo/backend/scripts/sync-content/verify/sync";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const globFilesMock = vi.hoisted(() => vi.fn());
const tryoutSourceLoadMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/scripts/sync-content/cli/logging", () => ({
  log: () => undefined,
  logError: () => undefined,
  logSuccess: () => undefined,
}));

vi.mock("@repo/backend/scripts/sync-content/convex/counts", () => ({
  getContentCounts: () =>
    Effect.succeed({
      articleReferences: 0,
      articles: 1,
      authors: 0,
      contentAuthors: 0,
      contentRoutes: 0,
      contentSearch: 0,
      curriculumLessons: 0,
      curriculumTopics: 0,
      learningProgramCoverage: 0,
      learningProgramSources: 0,
      learningPrograms: 0,
      publicRoutes: 0,
      publicRouteSyncState: 0,
      quranSurahs: 1,
      quranVerses: 1,
      questionChoices: 0,
      questions: 999,
      questionSets: 999,
      tryoutCountries: 999,
      tryoutExams: 999,
      tryoutSections: 999,
      tryoutSets: 999,
      tryoutTracks: 999,
    }),
}));

vi.mock("@repo/backend/scripts/sync-content/convex/inspection", () => ({
  getDataIntegrity: () =>
    Effect.succeed({
      activeTryoutsWithoutScale: ["obsolete-scale"],
      articlesWithoutReferences: [],
      orphanQuestionChoiceIds: ["obsolete-choice"],
      questionsWithoutAuthors: ["obsolete-author"],
      questionsWithoutChoices: ["obsolete-question"],
      sectionsWithoutTopics: [],
      totalArticles: 1,
      totalQuestions: 999,
      totalSections: 0,
    }),
}));

vi.mock("@repo/backend/scripts/sync-content/convex/ownership", () => ({
  readContentSyncOwnership: () => Effect.succeed({ tryoutsManaged: true }),
}));

vi.mock("@repo/backend/scripts/sync-content/runtime/files", () => ({
  globFiles: globFilesMock,
}));

vi.mock("@repo/backend/scripts/sync-content/verify/graph", () => ({
  verifyGraphIdentity: () => Effect.succeed(true),
}));

vi.mock("@repo/backend/scripts/sync-content/verify/quran", () => ({
  verifyQuranRuntime: () => Effect.succeed(true),
}));

vi.mock("@repo/backend/scripts/sync-content/verify/summary", () => ({
  logVerifySuccess: () => undefined,
}));

vi.mock("@repo/contents/_lib/quran", () => ({
  readQuranMetadata: () => Effect.succeed([{ numberOfVerses: 1 }]),
}));

vi.mock("@repo/contents/_types/material/registry", () => ({
  listLessonMaterialSources: () => [],
  listLessonRows: () => [],
}));

vi.mock("@repo/contents/_types/tryout/source", () => {
  tryoutSourceLoadMock();

  return { TRYOUT_SOURCES: [] };
});

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

describe("content verification", () => {
  beforeEach(() => {
    globFilesMock.mockReset();
    globFilesMock.mockImplementation((pattern: string) =>
      Effect.succeed(pattern === "articles/**/*.mdx" ? ["articles/id.mdx"] : [])
    );
    tryoutSourceLoadMock.mockClear();
  });

  it("ignores obsolete filesystem tryout checks under signed ownership", async () => {
    await expect(Effect.runPromise(verify(config))).resolves.toBeUndefined();

    expect(tryoutSourceLoadMock).not.toHaveBeenCalled();
    expect(
      globFilesMock.mock.calls.some(([pattern]) =>
        String(pattern).includes("question-bank/tryout/")
      )
    ).toBe(false);
  });
});
