import { internal } from "@repo/backend/convex/_generated/api";
import { clean } from "@repo/backend/scripts/sync-content/cleanup/clean";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import { getFunctionName } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const callConvexMutationMock = vi.hoisted(() => vi.fn());
const getStaleArticleCurriculumContentMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/scripts/sync-content/cleanup/source", () => ({
  collectFilesystemArticleCurriculumSlugs: () =>
    Effect.succeed({
      articleSlugs: [],
      curriculumLessonSlugs: [],
      curriculumTopicSlugs: [],
    }),
}));

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
  getUnusedAuthors: () => Effect.succeed({ unusedAuthors: [] }),
}));

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

beforeEach(() => {
  callConvexMutationMock.mockReset();
  callConvexMutationMock.mockReturnValue(Effect.succeed({ deleted: 1 }));
  getStaleArticleCurriculumContentMock.mockReset();
  getStaleArticleCurriculumContentMock.mockReturnValue(
    Effect.succeed({
      staleArticles: [
        { id: "stale-id", locale: "id", sourcePath: "stale-source" },
      ],
      staleCurriculumLessons: [],
      staleCurriculumTopics: [],
    })
  );
});

describe("content cleanup", () => {
  it("deletes only stale Nakafa-owned content", async () => {
    await expect(
      Effect.runPromise(clean(config, { force: true }))
    ).resolves.toEqual({ deleted: 1, hasStale: true });

    expect(callConvexMutationMock).toHaveBeenCalledTimes(1);
    expect(getFunctionName(callConvexMutationMock.mock.calls[0]?.[1])).toBe(
      getFunctionName(
        internal.contentSync.mutations.articles.deleteStaleArticles
      )
    );
  });
});
