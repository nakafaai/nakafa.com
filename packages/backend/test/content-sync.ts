import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_DIGEST,
  testReleaseJson,
} from "@repo/backend/test/content-release";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";

/** Inserts one terminal release with an exact changed-item count. */
export async function insertCompletedRelease(
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
    throw new Error("Expected one completed content release.");
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

/** Inserts one release-owned identity consumed by read-model synchronization. */
export function insertReleaseItem(
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

/** Selects one completed release before its read models catch up. */
export async function selectActiveRelease(
  ctx: MutationCtx,
  identity: TestIdentity
) {
  const state = await ctx.db.query("contentState").unique();
  if (!state) {
    throw new Error("Expected content synchronization state.");
  }
  await ctx.db.patch("contentState", state._id, {
    activeManifestHash: identity.manifestHash,
    activeReleaseId: identity.releaseId,
    activeSequence: identity.sequence,
  });
}
