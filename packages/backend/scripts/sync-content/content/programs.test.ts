import { log } from "@repo/backend/scripts/sync-content/cli/logging";
import { syncLearningPrograms } from "@repo/backend/scripts/sync-content/content/programs";
import {
  callConvexMutation,
  callConvexQuery,
} from "@repo/backend/scripts/sync-content/convex/client";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { Effect } from "effect";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/scripts/sync-content/convex/client", () => ({
  callConvexMutation: vi.fn(),
  callConvexQuery: vi.fn(),
}));

vi.mock("@repo/backend/scripts/sync-content/cli/logging", () => ({
  log: vi.fn(),
}));

const config = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

const subjectGraph = createLearningGraphIdentityFromRoute({
  locale: "id",
  route: "material/lesson/biology/biodiversity",
});

assert(subjectGraph, "Expected subject graph fixture.");

const subjectRoute = {
  ...subjectGraph,
  authors: [],
  content_id: subjectGraph.assetId,
  kind: "curriculum-topic",
  locale: "id",
  markdown: true,
  route: "materi/biologi/keanekaragaman-makhluk-hidup",
  section: "material",
  sourcePath: "material/lesson/biology/biodiversity",
  syncedAt: 1,
  title: "Biodiversity",
} as const;

describe("sync-content learningPrograms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callConvexMutation)
      .mockReturnValueOnce(
        Effect.succeed({ created: 6, skipped: 0, updated: 0 })
      )
      .mockReturnValueOnce(
        Effect.succeed({ created: 0, skipped: 0, updated: 0 })
      )
      .mockReturnValueOnce(
        Effect.succeed({ created: 1, skipped: 0, updated: 0 })
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
          key: "merdeka",
          navigation: {
            levels: ["stage", "class", "subject", "topic"],
            model: "curriculum-tree",
          },
        }),
      ]),
    });
    expect(mutationCalls[1]?.[2]).toMatchObject({
      coverageRows: expect.arrayContaining([
        expect.objectContaining({
          coverageStatus: "partial",
          lensId: subjectGraph.lensId,
          programKey: "cambridge-international",
          sampleContentId: subjectGraph.assetId,
        }),
        expect.objectContaining({
          coverageStatus: "partial",
          lensId: subjectGraph.lensId,
          programKey: "merdeka",
          sampleContentId: subjectGraph.assetId,
        }),
        expect.objectContaining({
          coverageStatus: "partial",
          lensId: subjectGraph.lensId,
          programKey: "singapore-moe",
          sampleContentId: subjectGraph.assetId,
        }),
        expect.objectContaining({
          coverageStatus: "partial",
          lensId: subjectGraph.lensId,
          programKey: "united-states",
          sampleContentId: subjectGraph.assetId,
        }),
      ]),
    });
    expect(JSON.stringify(mutationCalls[1]?.[2])).not.toContain("curriculum/");
    expect(mutationCalls[2]?.[2]).toMatchObject({
      limit: 200,
      locale: "id",
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("Coverage: 4 rows from 1 graph routes")
    );
  });
});
