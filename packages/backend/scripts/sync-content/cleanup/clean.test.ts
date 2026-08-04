import { internal } from "@repo/backend/convex/_generated/api";
import { clean } from "@repo/backend/scripts/sync-content/cleanup/clean";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import { getFunctionName } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const callConvexMutationMock = vi.hoisted(() => vi.fn());
const collectFilesystemTryoutSlugsMock = vi.hoisted(() => vi.fn());
const getStaleArticleCurriculumContentMock = vi.hoisted(() => vi.fn());
const getStaleTryoutContentMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/scripts/sync-content/cleanup/source", () => ({
  collectFilesystemArticleCurriculumSlugs: () =>
    Effect.succeed({
      articleSlugs: [],
      curriculumLessonSlugs: [],
      curriculumTopicSlugs: [],
    }),
  collectFilesystemTryoutSlugs: collectFilesystemTryoutSlugsMock,
}));

const emptyFilesystemTryoutSlugs = {
  questionSetSourcePaths: [],
  questionSourceKeys: [],
  questionSourcePaths: [],
  tryoutCountryKeys: [],
  tryoutExamKeys: [],
  tryoutSectionKeys: [],
  tryoutSetKeys: [],
  tryoutTrackKeys: [],
};

vi.mock("@repo/backend/scripts/sync-content/cli/logging", () => ({
  log: () => undefined,
  logStaleItems: () => undefined,
  logSuccess: () => undefined,
}));

vi.mock("@repo/backend/scripts/sync-content/convex/client", () => ({
  callConvexMutation: callConvexMutationMock,
}));

vi.mock("@repo/backend/scripts/sync-content/convex/inspection", () => ({
  getStaleArticleCurriculumContent: getStaleArticleCurriculumContentMock,
  getStaleTryoutContent: getStaleTryoutContentMock,
  getUnusedAuthors: () => Effect.succeed({ unusedAuthors: [] }),
}));

vi.mock("@repo/backend/scripts/sync-content/convex/ownership", () => ({
  readContentSyncOwnership: () => Effect.succeed({ tryoutsManaged: true }),
}));

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

const staleItem = {
  id: "stale-id",
  locale: "id",
  sourcePath: "stale-source",
};

beforeEach(() => {
  callConvexMutationMock.mockReset();
  callConvexMutationMock.mockReturnValue(Effect.succeed({ deleted: 1 }));
  collectFilesystemTryoutSlugsMock.mockReset();
  collectFilesystemTryoutSlugsMock.mockReturnValue(
    Effect.succeed(emptyFilesystemTryoutSlugs)
  );
  getStaleArticleCurriculumContentMock.mockReset();
  getStaleArticleCurriculumContentMock.mockReturnValue(
    Effect.succeed({
      staleArticles: [staleItem],
      staleCurriculumLessons: [],
      staleCurriculumTopics: [],
    })
  );
  getStaleTryoutContentMock.mockReset();
  getStaleTryoutContentMock.mockReturnValue(
    Effect.succeed({
      staleQuestions: [staleItem],
      staleQuestionSets: [staleItem],
      staleTryoutCountries: [staleItem],
      staleTryoutExams: [staleItem],
      staleTryoutSections: [staleItem],
      staleTryoutSets: [staleItem],
      staleTryoutTracks: [staleItem],
    })
  );
});

describe("content cleanup", () => {
  it("does not mutate filesystem tryout rows after signed ownership activates", async () => {
    await expect(
      Effect.runPromise(clean(config, { force: true }))
    ).resolves.toEqual({ deleted: 1, hasStale: true });

    expect(callConvexMutationMock).toHaveBeenCalledTimes(1);
    expect(collectFilesystemTryoutSlugsMock).not.toHaveBeenCalled();
    expect(getStaleTryoutContentMock).not.toHaveBeenCalled();
    expect(getFunctionName(callConvexMutationMock.mock.calls[0]?.[1])).toBe(
      getFunctionName(
        internal.contentSync.mutations.articles.deleteStaleArticles
      )
    );
  });
});
