import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { syncSearch } from "@repo/backend/convex/contentRelease/search/sync";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_DIGEST,
  testProjectionJson,
  testReleaseJson,
} from "@repo/backend/test/content-release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  insertRuntimeBinding,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime-head";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const BASE = {
  manifestHash: `sha256:${"8".repeat(64)}`,
  releaseId: "release-search-sync-base",
  sequence: 1,
} satisfies TestIdentity;
const NEXT = {
  manifestHash: `sha256:${"9".repeat(64)}`,
  releaseId: "release-search-sync-next",
  sequence: 2,
} satisfies TestIdentity;

/** Inserts one terminal release with an exact changed-item count. */
async function insertCompletedRelease(
  ctx: MutationCtx,
  identity: TestIdentity,
  itemCount: number,
  base?: TestIdentity
) {
  await insertZeroRelease(ctx, {
    ...identity,
    base,
    role: "candidate",
    status: "completed",
  });
  const release = await ctx.db
    .query("contentReleases")
    .withIndex("by_releaseId", (index) =>
      index.eq("releaseId", identity.releaseId)
    )
    .unique();
  if (!release) {
    throw new Error("Expected completed search release.");
  }
  await ctx.db.patch("contentReleases", release._id, {
    releaseJson: testReleaseJson({
      baseManifestHash: base?.manifestHash,
      baseReleaseId: base?.releaseId,
      itemCount,
      manifestHash: identity.manifestHash,
      projectionCount: itemCount,
      releaseId: identity.releaseId,
      resultCount: itemCount,
      upsertCount: itemCount,
    }),
  });
}

/** Inserts one release-owned identity consumed by active search synchronization. */
function insertItem(
  ctx: MutationCtx,
  identity: TestIdentity,
  contentKey: string,
  index: number
) {
  return ctx.db.insert("contentItems", {
    artifactReady: false,
    contentKey,
    index,
    itemBatchHash: TEST_DIGEST,
    itemBatchIndex: 0,
    itemJson: "{}",
    locale: "en",
    projectionReady: false,
    releaseId: identity.releaseId,
    rollbackJson: "{}",
    sequence: identity.sequence,
    stagedAt: 0,
  });
}

/** Inserts one public head selected by the active release sequence. */
async function insertPublicHead(
  ctx: MutationCtx,
  identity: TestIdentity,
  contentKey: string,
  index: number,
  plainText: string
) {
  const publicPath = `test/sync-${index}`;
  await insertRuntimeVersion(ctx, "public", contentKey, {
    artifactHash: `sha256:${(identity.sequence * 32 + index)
      .toString(16)
      .padStart(64, "0")}`,
    headReleaseId: identity.releaseId,
    headSequence: identity.sequence,
    plainText,
    projectionJson: testProjectionJson({ contentKey, publicPath }),
    publicPath,
  });
  await insertRuntimeBinding(ctx, contentKey, {
    bindingReleaseId: identity.releaseId,
    bindingSequence: identity.sequence,
    publicPath,
  });
}

/** Selects one completed release before its search model catches up. */
async function selectActive(ctx: MutationCtx, identity: TestIdentity) {
  const state = await ctx.db.query("contentState").unique();
  if (!state) {
    throw new Error("Expected search synchronization state.");
  }
  await ctx.db.patch("contentState", state._id, {
    activeManifestHash: identity.manifestHash,
    activeReleaseId: identity.releaseId,
    activeSequence: identity.sequence,
  });
}

describe("contentRelease/search/sync", () => {
  it("resumes bounded pages and publishes the generation only when complete", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 9);
      await insertTestState(ctx, { active: BASE, nextSequence: 2 });
      for (let index = 0; index < 9; index += 1) {
        const contentKey = `test:sync-${index}`;
        await insertItem(ctx, BASE, contentKey, index);
        await insertPublicHead(ctx, BASE, contentKey, index, "search body");
      }
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncSearch(ctx, BASE.releaseId)))
    ).resolves.toEqual({ complete: false, processed: 8 });
    const pending = await t.run((ctx) => ctx.db.query("contentState").unique());
    expect(pending?.searchReleaseId).toBeUndefined();
    await expect(
      t.mutation((ctx) => runConvexProgram(syncSearch(ctx, BASE.releaseId)))
    ).resolves.toEqual({ complete: true, processed: 1 });
    const stored = await t.run(async (ctx) => ({
      release: await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", BASE.releaseId)
        )
        .unique(),
      rows: await ctx.db.query("contentIndex").take(10),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(stored.rows).toHaveLength(9);
    expect(stored.release).toMatchObject({
      searchIndex: 8,
      searchSyncedAt: expect.any(Number),
    });
    expect(stored.state).toMatchObject({
      searchManifestHash: BASE.manifestHash,
      searchReleaseId: BASE.releaseId,
      searchSequence: BASE.sequence,
    });
  });

  it("replaces, removes, and idempotently replays changed active entries", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 3);
      await insertTestState(ctx, { active: BASE, nextSequence: 3 });
      for (let index = 0; index < 3; index += 1) {
        const contentKey = `test:change-${index}`;
        await insertItem(ctx, BASE, contentKey, index);
        await insertPublicHead(ctx, BASE, contentKey, index, "old body");
      }
    });
    await t.mutation((ctx) =>
      runConvexProgram(syncSearch(ctx, BASE.releaseId))
    );
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, NEXT, 3, BASE);
      for (let index = 0; index < 3; index += 1) {
        await insertItem(ctx, NEXT, `test:change-${index}`, index);
      }
      await insertPublicHead(ctx, NEXT, "test:change-0", 0, "new body");
      await ctx.db.insert("contentHeads", {
        contentKey: "test:change-1",
        family: "material",
        index: 1,
        locale: "en",
        operation: "delete",
        releaseId: NEXT.releaseId,
        sequence: NEXT.sequence,
      });
      await insertRuntimeVersion(ctx, "authenticated", "test:change-2", {
        headReleaseId: NEXT.releaseId,
        headSequence: NEXT.sequence,
        projectionJson: testProjectionJson({
          contentKey: "test:change-2",
          publicPath: "test/sync-2",
        }),
        publicPath: "test/sync-2",
      });
      await selectActive(ctx, NEXT);
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncSearch(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ complete: true, processed: 3 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncSearch(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ complete: true, processed: 0 });
    const rows = await t.run((ctx) => ctx.db.query("contentIndex").take(4));
    expect(rows).toMatchObject([
      {
        contentKey: "test:change-0",
        releaseId: NEXT.releaseId,
        text: expect.stringContaining("new body"),
      },
    ]);
  });
});
