import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { abortProgram } from "@repo/backend/convex/contentRelease/abort";
import {
  RELEASE_PAGE_LIMIT,
  ROLLBACK_RETENTION_MS,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  ABORT_ITEM_COUNT,
  ABORT_RELEASE_ID,
  seedAbortRelease,
} from "@repo/backend/test/content-abort";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

/** Runs one server-cursor abort page at the native Convex test boundary. */
function abort(ctx: MutationCtx, releaseId = ABORT_RELEASE_ID) {
  return runConvexProgram(abortProgram(ctx, releaseId));
}

describe("contentRelease/abort", () => {
  it("resumes durable deletion and accepts terminal response-loss retries", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedAbortRelease);

    const first = await t.mutation((ctx) => abort(ctx));
    const completed = await t.mutation((ctx) => abort(ctx));
    const repeated = await t.mutation((ctx) => abort(ctx));
    const stored = await t.run(async (ctx) => ({
      items: await ctx.db.query("contentItems").collect(),
      release: await ctx.db.query("contentReleases").unique(),
      state: await ctx.db.query("contentState").unique(),
    }));

    expect(first).toEqual({
      complete: false,
      processedItems: RELEASE_PAGE_LIMIT,
      releaseId: ABORT_RELEASE_ID,
      totalItems: ABORT_ITEM_COUNT,
    });
    expect(completed).toEqual({
      complete: true,
      processedItems: ABORT_ITEM_COUNT,
      releaseId: ABORT_RELEASE_ID,
      totalItems: ABORT_ITEM_COUNT,
    });
    expect(repeated).toEqual(completed);
    expect(stored.items).toHaveLength(0);
    expect(stored.release?.status).toBe("aborted");
    expect(stored.state?.candidateReleaseId).toBeUndefined();
  });

  it("requires recovery abort before candidate abort", async () => {
    const t = convexTest(schema, convexModules);
    const candidate = {
      manifestHash: `sha256:${"1".repeat(64)}`,
      releaseId: ABORT_RELEASE_ID,
      sequence: 1,
    } satisfies TestIdentity;
    const recovery = {
      manifestHash: `sha256:${"b".repeat(64)}`,
      releaseId: "release-abort-recovery",
      sequence: 2,
    } satisfies TestIdentity;
    await t.mutation(seedAbortRelease);
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...recovery,
        base: candidate,
        originReleaseId: candidate.releaseId,
        role: "recovery",
        status: "verified",
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        nextSequence: 3,
        recoveryManifestHash: recovery.manifestHash,
        recoveryReleaseId: recovery.releaseId,
        recoverySequence: recovery.sequence,
      });
    });

    await expect(t.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.mutation((ctx) => abort(ctx, recovery.releaseId))
    ).resolves.toMatchObject({ complete: true });
    await expect(t.mutation((ctx) => abort(ctx))).resolves.toMatchObject({
      complete: false,
    });
  });

  it("starts artifact retention when abort removes its final reference", async () => {
    const t = convexTest(schema, convexModules);
    const artifactHash = `sha256:${"d".repeat(64)}`;
    await t.mutation(async (ctx) => {
      await seedAbortRelease(ctx);
      const item = await ctx.db
        .query("contentItems")
        .withIndex("by_releaseId_and_index", (query) =>
          query.eq("releaseId", ABORT_RELEASE_ID).eq("index", 0)
        )
        .unique();
      if (!item) {
        throw new Error("Expected staged abort item.");
      }
      await ctx.db.patch("contentItems", item._id, {
        artifactHash,
        artifactReady: true,
      });
      await ctx.db.insert("contentArtifacts", {
        artifactHash,
        artifactJson: "{}",
        createdAt: 0,
        retainUntil: 0,
      });
    });
    const startedAt = Date.now();

    await t.mutation((ctx) => abort(ctx));

    const artifact = await t.run((ctx) =>
      ctx.db.query("contentArtifacts").unique()
    );
    expect(artifact?.retainUntil).toBeGreaterThanOrEqual(
      startedAt + ROLLBACK_RETENTION_MS
    );
  });

  it("rejects an active release and corrupted abort progress", async () => {
    const active = convexTest(schema, convexModules);
    const identity = {
      manifestHash: `sha256:${"c".repeat(64)}`,
      releaseId: "release-active",
      sequence: 1,
    } satisfies TestIdentity;
    await active.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...identity,
        role: "candidate",
        status: "completed",
      });
    });
    await expect(
      active.mutation((ctx) => abort(ctx, identity.releaseId))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

    const corrupt = convexTest(schema, convexModules);
    await corrupt.mutation(seedAbortRelease);
    await corrupt.mutation((ctx) => abort(ctx));
    await corrupt.mutation(async (ctx) => {
      const remaining = await ctx.db.query("contentItems").collect();
      for (const item of remaining) {
        await ctx.db.delete("contentItems", item._id);
      }
    });
    await expect(corrupt.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("fails closed if terminal aborted state becomes reachable again", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedAbortRelease);
    await t.mutation((ctx) => abort(ctx));
    await t.mutation((ctx) => abort(ctx));
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        candidateManifestHash: `sha256:${"1".repeat(64)}`,
        candidateReleaseId: ABORT_RELEASE_ID,
        candidateSequence: 1,
      });
    });

    await expect(t.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
