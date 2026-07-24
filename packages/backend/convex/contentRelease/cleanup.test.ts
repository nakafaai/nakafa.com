import { MAX_CLEANUP_PAGE_COUNT } from "@nakafa/aksara-contracts/release/lifecycle";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_ARTIFACT_HASH,
  TEST_DIGEST,
  testProjectionJson,
  testRollbackJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  requireFixtureValue,
  seedTryoutArtifactState,
} from "@repo/backend/test/tryout-content";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const cleanup = internal.contentRelease.cleanup.cleanup;
const RELEASE = {
  manifestHash: `sha256:${"5".repeat(64)}`,
  releaseId: "release-cleanup",
  sequence: 1,
} satisfies TestIdentity;
const NOW = Date.UTC(2026, 6, 23, 12);

/** Inserts one detached terminal release eligible for cleanup. */
function insertRelease(ctx: MutationCtx) {
  return insertZeroRelease(ctx, {
    ...RELEASE,
    role: "candidate",
    status: "aborted",
  });
}

/** Inserts one expired or retained immutable artifact. */
function insertArtifact(ctx: MutationCtx, index: number, retainUntil = 0) {
  return ctx.db.insert("contentArtifacts", {
    artifactHash: `sha256:${index.toString(16).padStart(64, "0")}`,
    artifactJson: "{}",
    createdAt: NOW,
    retainUntil,
  });
}

/** Inserts one historical head that keeps the fixture artifact reachable. */
function insertHead(ctx: MutationCtx) {
  return ctx.db.insert("contentHeads", {
    artifactHash: TEST_ARTIFACT_HASH,
    compilerConfigHash: TEST_DIGEST,
    contentKey: "test:retained-head",
    delivery: "public",
    family: "material",
    index: 0,
    locale: "en",
    operation: "upsert",
    projectionHash: TEST_DIGEST,
    projectionJson: testProjectionJson({
      contentKey: "test:retained-head",
      publicPath: "test/retained-head",
    }),
    releaseId: "release-history",
    rendererDomain: "mathematics",
    sequence: 2,
    sourceHash: TEST_DIGEST,
    sourcePath: "packages/corpus/test/retained-head/en.mdx",
  });
}

/** Inserts one historical item that keeps the fixture artifact reachable. */
function insertItem(ctx: MutationCtx) {
  return ctx.db.insert("contentItems", {
    artifactHash: TEST_ARTIFACT_HASH,
    artifactBatchHash: TEST_DIGEST,
    artifactBatchIndex: 0,
    artifactReady: true,
    contentKey: "test:retained-item",
    index: 0,
    itemBatchHash: TEST_DIGEST,
    itemBatchIndex: 0,
    itemJson: testUpsertJson({
      artifactHash: TEST_ARTIFACT_HASH,
      contentKey: "test:retained-item",
      releaseId: "release-history",
    }),
    locale: "en",
    projectionBatchHash: TEST_DIGEST,
    projectionBatchIndex: 0,
    projectionJson: testProjectionJson({
      contentKey: "test:retained-item",
      publicPath: "test/retained-item",
    }),
    projectionReady: true,
    releaseId: "release-history",
    rollbackJson: testRollbackJson({
      contentKey: "test:retained-item",
      releaseId: "release-history",
    }),
    sequence: 2,
    stagedAt: NOW,
  });
}

describe("contentRelease/cleanup", () => {
  it("deletes expired unreachable artifacts in resumable bounded pages", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRelease(ctx);
      for (let index = 0; index < MAX_CLEANUP_PAGE_COUNT + 1; index += 1) {
        await insertArtifact(ctx, index);
      }
    });

    const first = await t.mutation(cleanup, { releaseId: RELEASE.releaseId });
    const completed = await t.mutation(cleanup, {
      releaseId: RELEASE.releaseId,
    });
    const repeated = await t.mutation(cleanup, {
      releaseId: RELEASE.releaseId,
    });

    expect(first).toEqual({
      complete: false,
      deletedArtifacts: MAX_CLEANUP_PAGE_COUNT,
      releaseId: RELEASE.releaseId,
    });
    expect(completed).toEqual({
      complete: true,
      deletedArtifacts: MAX_CLEANUP_PAGE_COUNT + 1,
      releaseId: RELEASE.releaseId,
    });
    expect(repeated).toEqual(completed);
    await expect(
      t.run((ctx) => ctx.db.query("contentArtifacts").take(1))
    ).resolves.toEqual([]);
  });

  it("retains every artifact referenced by immutable heads or items", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRelease(ctx);
      await ctx.db.insert("contentArtifacts", {
        artifactHash: TEST_ARTIFACT_HASH,
        artifactJson: "{}",
        createdAt: NOW,
        retainUntil: 0,
      });
      await insertHead(ctx);
      await insertItem(ctx);
    });

    await expect(
      t.mutation(cleanup, { releaseId: RELEASE.releaseId })
    ).resolves.toEqual({
      complete: true,
      deletedArtifacts: 0,
      releaseId: RELEASE.releaseId,
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentArtifacts").unique())
    ).resolves.toMatchObject({ artifactHash: TEST_ARTIFACT_HASH });
  });

  it("retains question and answer artifacts frozen by attempt placements", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(async (ctx) => {
      await insertRelease(ctx);
      return seedTryoutArtifactState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "cleanup-placement",
      });
    });
    const questionHash = requireFixtureValue(fixture.questionHashes);
    const answerHash = requireFixtureValue(fixture.answerHashes);

    await expect(
      t.mutation(cleanup, { releaseId: RELEASE.releaseId })
    ).resolves.toEqual({
      complete: true,
      deletedArtifacts: 0,
      releaseId: RELEASE.releaseId,
    });
    await expect(
      t.run((ctx) =>
        ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (query) =>
            query.eq("artifactHash", questionHash)
          )
          .unique()
      )
    ).resolves.toMatchObject({ artifactHash: questionHash });
    await expect(
      t.run((ctx) =>
        ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (query) =>
            query.eq("artifactHash", answerHash)
          )
          .unique()
      )
    ).resolves.toMatchObject({ artifactHash: answerHash });
  });

  it("returns an exact retry deadline for retained future artifacts", async () => {
    const t = convexTest(schema, convexModules);
    const retryAt = Date.now() + 60_000;
    await t.mutation(async (ctx) => {
      await insertRelease(ctx);
      await insertArtifact(ctx, 0, retryAt);
      await insertArtifact(ctx, 1, retryAt + 60_000);
    });

    const first = await t.mutation(cleanup, { releaseId: RELEASE.releaseId });
    const repeated = await t.mutation(cleanup, {
      releaseId: RELEASE.releaseId,
    });

    expect(first).toEqual({
      complete: false,
      deletedArtifacts: 0,
      releaseId: RELEASE.releaseId,
      retryAt,
    });
    expect(repeated).toEqual(first);
  });

  it("rejects reachable releases and invalid durable counters", async () => {
    const reachable = convexTest(schema, convexModules);
    await reachable.mutation(async (ctx) => {
      await insertRelease(ctx);
      await ctx.db.insert("contentState", {
        candidateManifestHash: RELEASE.manifestHash,
        candidateReleaseId: RELEASE.releaseId,
        candidateSequence: RELEASE.sequence,
        key: "primary",
        nextSequence: 2,
        updatedAt: NOW,
      });
    });
    await expect(
      reachable.mutation(cleanup, { releaseId: RELEASE.releaseId })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

    const corrupted = convexTest(schema, convexModules);
    await corrupted.mutation(async (ctx) => {
      await insertRelease(ctx);
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected cleanup release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        cleanupDeletedArtifacts: -1,
      });
    });
    await expect(
      corrupted.mutation(cleanup, { releaseId: RELEASE.releaseId })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
