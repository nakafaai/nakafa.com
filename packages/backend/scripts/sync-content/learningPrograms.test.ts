import {
  callConvexMutation,
  callConvexQuery,
} from "@repo/backend/scripts/sync-content/convex";
import { syncLearningPrograms } from "@repo/backend/scripts/sync-content/learningPrograms";
import { log } from "@repo/backend/scripts/sync-content/logging";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/scripts/sync-content/convex", () => ({
  callConvexMutation: vi.fn(),
  callConvexQuery: vi.fn(),
}));

vi.mock("@repo/backend/scripts/sync-content/logging", () => ({
  log: vi.fn(),
}));

const config = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

const subjectGraph = createLearningGraphIdentityFromRoute({
  locale: "id",
  route: "subject/high-school/10/chemistry/atomic-structure",
});

if (!subjectGraph) {
  throw new Error("Expected subject graph fixture.");
}

const subjectRoute = {
  ...subjectGraph,
  authors: [],
  content_id: subjectGraph.assetId,
  kind: "subject-topic",
  locale: "id",
  markdown: true,
  route: "subject/high-school/10/chemistry/atomic-structure",
  section: "subject",
  syncedAt: 1,
  title: "Atomic Structure",
} as const;

describe("sync-content learningPrograms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callConvexMutation)
      .mockReturnValueOnce(
        Effect.succeed({ created: 4, skipped: 0, updated: 0 })
      )
      .mockReturnValueOnce(
        Effect.succeed({ created: 2, skipped: 0, updated: 0 })
      )
      .mockReturnValueOnce(Effect.succeed({ deleted: 0 }));
    vi.mocked(callConvexQuery)
      .mockReturnValueOnce(
        Effect.succeed({
          continueCursor: "",
          isDone: true,
          page: [subjectRoute],
        })
      )
      .mockReturnValue(
        Effect.succeed({
          continueCursor: "",
          isDone: true,
          page: [],
        })
      );
  });

  it("syncs catalog rows, graph-backed coverage, and stale coverage cleanup", async () => {
    const result = await Effect.runPromise(
      syncLearningPrograms(config, { locale: "id" })
    );
    const mutationCalls = vi.mocked(callConvexMutation).mock.calls;

    expect(result).toMatchObject({ created: 6, skipped: 0, updated: 0 });
    expect(mutationCalls[0]?.[2]).toMatchObject({
      programs: expect.arrayContaining([
        expect.objectContaining({
          key: "id-kurikulum-merdeka",
          navigation: {
            levels: ["class", "subject", "topic"],
            model: "class-subject-topic",
          },
        }),
      ]),
    });
    expect(mutationCalls[1]?.[2]).toMatchObject({
      coverageRows: expect.arrayContaining([
        expect.objectContaining({
          coverageStatus: "partial",
          lensId: subjectGraph.lensId,
          programKey: "id-kurikulum-merdeka",
          sampleContentId: subjectGraph.assetId,
        }),
        expect.objectContaining({
          coverageStatus: "available",
          lensId: subjectGraph.lensId,
          programKey: "nakafa-stem-path",
          sampleContentId: subjectGraph.assetId,
        }),
      ]),
    });
    expect(JSON.stringify(mutationCalls[1]?.[2])).not.toContain(
      "subject/high-school/10/chemistry"
    );
    expect(mutationCalls[2]?.[2]).toMatchObject({
      limit: 200,
      locale: "id",
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("Coverage: 2 rows from 1 graph routes")
    );
  });
});
