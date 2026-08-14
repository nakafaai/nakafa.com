import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { writeArticle } from "@repo/backend/convex/contentRelease/article/write";
import {
  acceptReaderCutover,
  readerAcceptanceBudget,
  verifyReaderAcceptanceBudget,
} from "@repo/backend/convex/contentRelease/cutover/readers";
import type { ReferenceProofCounts } from "@repo/backend/convex/contentRelease/cutover/referenceProofs";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_ARTICLE_PROJECTION,
  TEST_ARTICLE_PROJECTION_JSON,
} from "@repo/backend/test/content-runtime";
import {
  insertRuntimeBinding,
  insertRuntimeKey,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime-head";
import {
  provideHistoryTestTrust,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const SHA256_PREFIX = /^sha256:/;
const TEST_REFERENCE_PROOF_COUNTS = {
  article: 1,
  material: 0,
  materialTopic: 0,
  quran: 0,
  tryout: 0,
} satisfies ReferenceProofCounts;

describe("contentRelease/cutover/readers", () => {
  it("accepts exact retained history once and preserves the first checkpoint", async () => {
    const t = convexTest(schema, convexModules);
    const plan = await t.mutation(async (ctx) => {
      const fixture = await prepareReaderCutover(ctx);
      return fixture.plan;
    });
    const first = await t.mutation((ctx) =>
      runConvexProgram(
        provideHistoryTestTrust(
          acceptReaderCutover(ctx, plan, TEST_REFERENCE_PROOF_COUNTS)
        )
      )
    );
    const second = await t.mutation((ctx) =>
      runConvexProgram(
        provideHistoryTestTrust(
          acceptReaderCutover(ctx, plan, TEST_REFERENCE_PROOF_COUNTS)
        )
      )
    );
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentCutoverState").unique();
      if (!state) {
        throw new Error("Expected one accepted reader checkpoint.");
      }
      await ctx.db.patch("contentCutoverState", state._id, {
        phase: "audited",
      });
    });
    const advancedPhaseRetry = await t.mutation((ctx) =>
      runConvexProgram(
        provideHistoryTestTrust(
          acceptReaderCutover(ctx, plan, TEST_REFERENCE_PROOF_COUNTS)
        )
      )
    );
    const state = await t.query((ctx) =>
      ctx.db
        .query("contentCutoverState")
        .withIndex("by_key", (index) => index.eq("key", "phase1"))
        .unique()
    );

    expect(first).toEqual({
      acceptedAt: expect.any(Number),
      history: {
        attempts: 2,
        declaredFrozenPlacements: 2,
        markers: 2,
        releases: [
          { attempts: 1, releaseId: "retained-history-a" },
          { attempts: 1, releaseId: "retained-history-b" },
        ],
        snapshotId: expect.stringMatching(SHA256_PREFIX),
      },
      referenceProofs: TEST_REFERENCE_PROOF_COUNTS,
    });
    expect(second).toEqual(first);
    expect(advancedPhaseRetry).toEqual(first);
    expect(state?.readerCutoverReceipt).toEqual(first);
    expect(state?.updatedAt).toBe(first.acceptedAt);
  });

  it("rejects acceptance when one completion marker is missing", async () => {
    const t = convexTest(schema, convexModules);
    const plan = await t.mutation(async (ctx) => {
      const fixture = await prepareReaderCutover(ctx);
      return fixture.plan;
    });
    await t.mutation(async (ctx) => {
      const marker = await ctx.db.query("tryoutAttemptHistory").first();
      if (!marker) {
        throw new Error("Expected a retained history marker fixture.");
      }
      await ctx.db.delete("tryoutAttemptHistory", marker._id);
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          provideHistoryTestTrust(
            acceptReaderCutover(ctx, plan, TEST_REFERENCE_PROOF_COUNTS)
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_NOT_READY" },
    });

    const state = await t.query((ctx) =>
      ctx.db.query("contentCutoverState").first()
    );
    expect(state?.readerCutoverReceipt).toBeUndefined();
  });

  it("rejects acceptance when one signed reference proof is missing", async () => {
    const t = convexTest(schema, convexModules);
    const plan = await t.mutation(async (ctx) => {
      const fixture = await prepareReaderCutover(ctx);
      const state = await ctx.db.query("contentCutoverState").unique();
      if (!state) {
        throw new Error("Expected one reader cutover checkpoint.");
      }
      await ctx.db.patch("contentCutoverState", state._id, {
        materialTopicReferenceProof: undefined,
      });
      return fixture.plan;
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          provideHistoryTestTrust(
            acceptReaderCutover(ctx, plan, TEST_REFERENCE_PROOF_COUNTS)
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const state = await t.query((ctx) =>
      ctx.db.query("contentCutoverState").first()
    );
    expect(state?.readerCutoverReceipt).toBeUndefined();
  });

  it("rejects a first acceptance after the quiescent phase", async () => {
    const t = convexTest(schema, convexModules);
    const plan = await t.mutation(async (ctx) => {
      const fixture = await prepareReaderCutover(ctx);
      const state = await ctx.db.query("contentCutoverState").unique();
      if (!state) {
        throw new Error("Expected one reader cutover checkpoint.");
      }
      await ctx.db.patch("contentCutoverState", state._id, {
        phase: "audited",
      });
      return fixture.plan;
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          provideHistoryTestTrust(
            acceptReaderCutover(ctx, plan, TEST_REFERENCE_PROOF_COUNTS)
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });

  it("accepts cold reads after an unrelated transaction read", async () => {
    const t = convexTest(schema, convexModules);
    const plan = await t.mutation(async (ctx) => {
      const fixture = await prepareReaderCutover(ctx);
      return fixture.plan;
    });

    const receipt = await t.mutation(async (ctx) => {
      await ctx.db.query("contentCutoverState").first();
      return runConvexProgram(
        provideHistoryTestTrust(
          acceptReaderCutover(ctx, plan, TEST_REFERENCE_PROOF_COUNTS)
        )
      );
    });
    const state = await t.query((ctx) =>
      ctx.db.query("contentCutoverState").unique()
    );

    expect(receipt.history).toMatchObject({ attempts: 2, markers: 2 });
    expect(state?.readerCutoverReceipt).toEqual(receipt);
  });

  it("grounds the exact cold-path transaction ceilings", () => {
    expect(readerAcceptanceBudget).toEqual({
      bytesRead: 524_288,
      databaseQueries: 4,
      documentsRead: 44,
      functionsScheduled: 0,
    });
  });

  it("accepts the rehearsal delta from an arbitrary baseline", async () => {
    const before = acceptanceMetrics({
      bytesRead: 5000,
      databaseQueries: 108,
      documentsRead: 6,
      functionsScheduled: 2,
    });

    await expect(
      Effect.runPromise(
        verifyReaderAcceptanceBudget(
          before,
          acceptanceMetrics({
            bytesRead: 66_752,
            databaseQueries: 112,
            documentsRead: 50,
            functionsScheduled: 2,
          })
        )
      )
    ).resolves.toBeUndefined();
  });

  it.each([
    {
      name: "byte ceiling",
      before: acceptanceMetrics(),
      after: acceptanceMetrics({
        bytesRead: readerAcceptanceBudget.bytesRead + 1,
      }),
    },
    {
      name: "query ceiling",
      before: acceptanceMetrics(),
      after: acceptanceMetrics({
        databaseQueries: readerAcceptanceBudget.databaseQueries + 1,
      }),
    },
    {
      name: "document ceiling",
      before: acceptanceMetrics(),
      after: acceptanceMetrics({
        documentsRead: readerAcceptanceBudget.documentsRead + 1,
      }),
    },
    {
      name: "schedule ceiling",
      before: acceptanceMetrics(),
      after: acceptanceMetrics({
        functionsScheduled: readerAcceptanceBudget.functionsScheduled + 1,
      }),
    },
    {
      name: "negative byte delta",
      before: acceptanceMetrics({ bytesRead: 1 }),
      after: acceptanceMetrics(),
    },
    {
      name: "negative query delta",
      before: acceptanceMetrics({ databaseQueries: 1 }),
      after: acceptanceMetrics(),
    },
    {
      name: "negative document delta",
      before: acceptanceMetrics({ documentsRead: 1 }),
      after: acceptanceMetrics(),
    },
    {
      name: "negative schedule delta",
      before: acceptanceMetrics({ functionsScheduled: 1 }),
      after: acceptanceMetrics(),
    },
  ])("fails closed beyond the $name", async ({ after, before }) => {
    await expect(
      Effect.runPromise(
        verifyReaderAcceptanceBudget(before, after).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "ReleaseError",
      code: "CONTENT_RELEASE_LIMIT",
    });
  });
});

function acceptanceMetrics(
  override: Partial<{
    readonly bytesRead: number;
    readonly databaseQueries: number;
    readonly documentsRead: number;
    readonly functionsScheduled: number;
  }> = {}
) {
  return {
    bytesRead: metric(override.bytesRead ?? 0),
    databaseQueries: metric(override.databaseQueries ?? 0),
    documentsRead: metric(override.documentsRead ?? 0),
    functionsScheduled: metric(override.functionsScheduled ?? 0),
  };
}

function metric(used: number) {
  return { remaining: 0, used };
}

async function prepareReaderCutover(ctx: MutationCtx) {
  const fixture = await seedRetainedTryoutHistory(ctx);
  await insertReaderArticle(ctx);
  const state = await ctx.db.query("contentState").unique();
  if (!(state?.activeReleaseId && state.activeSequence !== undefined)) {
    throw new Error("Expected one active retained-history release.");
  }
  await insertQuiescentCheckpoint(
    ctx,
    state.activeReleaseId,
    state.activeSequence
  );
  return fixture;
}

async function insertReaderArticle(ctx: MutationCtx) {
  const state = await ctx.db.query("contentState").unique();
  if (!(state?.activeReleaseId && state.activeSequence !== undefined)) {
    throw new Error("Expected one active retained-history release.");
  }
  const activeSequence = state.activeSequence;
  const projection = TEST_ARTICLE_PROJECTION;
  await insertRuntimeKey(ctx, projection.contentKey, {
    headSequence: activeSequence,
    projectionJson: TEST_ARTICLE_PROJECTION_JSON,
  });
  await insertRuntimeVersion(ctx, "public", projection.contentKey, {
    headReleaseId: state.activeReleaseId,
    headSequence: activeSequence,
    projectionJson: TEST_ARTICLE_PROJECTION_JSON,
    publicPath: projection.publicPath,
    rendererDomain: "politics",
    sourcePath: `packages/corpus/${projection.contentKey}/${projection.locale}.mdx`,
  });
  await insertRuntimeBinding(ctx, projection.contentKey, {
    bindingReleaseId: state.activeReleaseId,
    bindingSequence: activeSequence,
    locale: projection.locale,
    publicPath: projection.publicPath,
  });
  const head = await ctx.db
    .query("contentHeads")
    .withIndex("by_contentKey_and_locale_and_sequence", (index) =>
      index
        .eq("contentKey", projection.contentKey)
        .eq("locale", projection.locale)
        .eq("sequence", activeSequence)
    )
    .unique();
  if (!head) {
    throw new Error("Expected one retained reader article head.");
  }
  await runConvexProgram(writeArticle(ctx, head, projection));
  const article = await ctx.db.query("articleCatalog").unique();
  if (!article) {
    throw new Error("Expected one retained reader article.");
  }
}

async function insertQuiescentCheckpoint(
  ctx: MutationCtx,
  activeReleaseId: string,
  activeSequence: number
) {
  await ctx.db.insert("contentCutoverState", {
    articleReferenceProof: { count: 1, provedAt: 1 },
    auditedActiveReleaseId: activeReleaseId,
    auditedActiveSequence: activeSequence,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
    auditedNextSequence: activeSequence + 1,
    currentDeleted: 0,
    currentTableDeleted: 0,
    currentTableIndex: 0,
    currentTablePreserved: 0,
    inventoryVersion: "production-2026-08-13",
    key: "phase1",
    legacyDeleted: 0,
    legacyTableDeleted: 0,
    legacyTableIndex: 0,
    materialReferenceProof: { count: 0, provedAt: 1 },
    materialTopicReferenceProof: { count: 0, provedAt: 1 },
    phase: "quiescent",
    quranReferenceProof: { count: 0, provedAt: 1 },
    tryoutReferenceProof: { count: 0, provedAt: 1 },
    updatedAt: 1,
  });
}
