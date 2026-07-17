import { internal } from "@repo/backend/convex/_generated/api";
import { contentCountTables } from "@repo/backend/convex/contentSync/tables";
import { reset } from "@repo/backend/scripts/sync-content/cleanup/reset";
import {
  log,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import { ContentCountsSchema } from "@repo/backend/scripts/sync-content/contract/inspection";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex/client";
import { getContentCounts } from "@repo/backend/scripts/sync-content/convex/counts";
import { getFunctionName } from "convex/server";
import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/scripts/sync-content/convex/counts", () => ({
  getContentCounts: vi.fn(),
}));

vi.mock("@repo/backend/scripts/sync-content/convex/client", () => ({
  callConvexMutation: vi.fn(() =>
    Effect.succeed({ deleted: 0, hasMore: false })
  ),
}));

vi.mock("@repo/backend/scripts/sync-content/cli/logging", () => ({
  formatDuration: vi.fn(() => "1ms"),
  log: vi.fn(),
  logSuccess: vi.fn(),
  logWarning: vi.fn(),
}));

vi.mock("@repo/backend/scripts/sync-content/runtime/files", () => ({
  clearSyncState: vi.fn(() => Effect.void),
}));

const config = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

const emptyCounts = Schema.decodeUnknownSync(ContentCountsSchema)(
  Object.fromEntries(contentCountTables.map(({ field }) => [field, 0]))
);

/** Runs reset against exact count overrides. */
async function runReset(overrides: Partial<typeof emptyCounts>, force = false) {
  vi.mocked(getContentCounts).mockReturnValue(
    Effect.succeed({ ...emptyCounts, ...overrides })
  );

  await Effect.runPromise(reset(config, { force }));
}

/** Returns the ordered names of mutations requested by reset. */
function mutationNames() {
  return vi
    .mocked(callConvexMutation)
    .mock.calls.map(([, mutation]) => getFunctionName(mutation));
}

describe("sync-content reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callConvexMutation).mockReturnValue(
      Effect.succeed({ deleted: 0, hasMore: false })
    );
  });

  it("counts every reset-managed read model before deletion", async () => {
    await runReset({
      contentRouteCounts: 1,
      contentRoutePages: 2,
      contentRoutes: 1,
      contentSearch: 1,
      learningPlanItems: 3,
      learningProgramCoverage: 2,
      publicRouteSitemapCounts: 1,
      publicRouteSitemapPages: 2,
      quranSurahs: 1,
      quranVerses: 7,
    });

    expect(log).toHaveBeenCalledWith("  Public Sitemap Counts: 1");
    expect(log).toHaveBeenCalledWith("  Public Sitemap Pages:  2");
    expect(log).toHaveBeenCalledWith("  Total derived items:  21");
    expect(log).toHaveBeenCalledWith("\nTo delete all content, run:");
    expect(logSuccess).not.toHaveBeenCalled();
  });

  it("keeps the empty shortcut when every managed count is zero", async () => {
    await runReset({});

    expect(log).toHaveBeenCalledWith("  Total derived items:  0");
    expect(logSuccess).toHaveBeenCalledWith(
      "\nReset-managed content is already empty. Nothing to delete."
    );
    expect(log).not.toHaveBeenCalledWith("\nTo delete all content, run:");
  });

  it("preserves program catalog and learner history rows", async () => {
    await runReset(
      {
        learningProgramSources: 5,
        learningPrograms: 4,
        learningViews: 20_000,
        userLearningRecents: 500,
      },
      true
    );

    expect(log).toHaveBeenCalledWith("  Total preserved items: 20509");
    expect(logSuccess).toHaveBeenCalledWith(
      "\nReset-managed content is already empty. Nothing to delete."
    );
    expect(callConvexMutation).not.toHaveBeenCalled();
  });

  it("deletes generated plan items before program coverage", async () => {
    await runReset({ learningPlanItems: 3, learningProgramCoverage: 2 }, true);

    const mutations = mutationNames();
    const planItems = getFunctionName(
      internal.contentSync.reset.internal.deleteLearningPlanItemsBatch
    );
    const coverage = getFunctionName(
      internal.contentSync.reset.internal.deleteLearningProgramCoverageBatch
    );

    expect(mutations.indexOf(planItems)).toBeGreaterThanOrEqual(0);
    expect(mutations.indexOf(coverage)).toBeGreaterThan(
      mutations.indexOf(planItems)
    );
  });

  it("invalidates public route state before deleting route rows", async () => {
    await runReset({ publicRoutes: 1, publicRouteSyncState: 1 }, true);

    const mutations = mutationNames();
    const syncState = getFunctionName(
      internal.contentSync.reset.internal.deletePublicRouteSyncStateBatch
    );
    const routes = getFunctionName(
      internal.contentSync.reset.internal.deletePublicRoutesBatch
    );

    expect(mutations.indexOf(syncState)).toBeGreaterThanOrEqual(0);
    expect(mutations.indexOf(routes)).toBeGreaterThan(
      mutations.indexOf(syncState)
    );
  });

  it("unpublishes sitemap counts before deleting their artifact pages", async () => {
    await runReset(
      { publicRouteSitemapCounts: 1, publicRouteSitemapPages: 2 },
      true
    );

    const mutations = mutationNames();
    const counts = getFunctionName(
      internal.contentSync.reset.internal.deletePublicRouteSitemapCountsBatch
    );
    const pages = getFunctionName(
      internal.contentSync.reset.internal.deletePublicRouteSitemapPagesBatch
    );

    expect(mutations.indexOf(counts)).toBeGreaterThanOrEqual(0);
    expect(mutations.indexOf(pages)).toBeGreaterThan(mutations.indexOf(counts));
  });

  it("does not delete selected program catalog rows", async () => {
    await runReset(
      {
        learningProgramCoverage: 1,
        learningProgramSources: 1,
        learningPrograms: 1,
      },
      true
    );

    const mutations = mutationNames();

    expect(mutations).toContain(
      getFunctionName(
        internal.contentSync.reset.internal.deleteLearningProgramCoverageBatch
      )
    );
    expect(
      mutations.filter(
        (mutation) =>
          mutation.includes("learningProgram") && !mutation.includes("Coverage")
      )
    ).toEqual([]);
  });
});
