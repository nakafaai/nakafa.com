import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  TEST_DIGEST,
  testProjectionJson,
  testRollbackJson,
  testRouteJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";

export const COMPACTION_OLD_TIME = Date.now() - ROLLBACK_RETENTION_MS - 1000;

/** Creates one exact technical release identity for compaction tests. */
export function compactionIdentity(sequence: number) {
  return {
    manifestHash: `sha256:${sequence.toString(16).padStart(64, "0")}`,
    releaseId: `release-compact-${sequence}`,
    sequence,
  } satisfies TestIdentity;
}

/** Inserts one completed release and controls its retention timestamp. */
export async function insertCompletedRelease(
  ctx: MutationCtx,
  identity: TestIdentity,
  base?: TestIdentity,
  createdAt = COMPACTION_OLD_TIME
) {
  await insertZeroRelease(ctx, {
    ...identity,
    base,
    role: "candidate",
    status: "completed",
  });
  const release = await ctx.db
    .query("contentReleases")
    .withIndex("by_releaseId", (query) =>
      query.eq("releaseId", identity.releaseId)
    )
    .unique();
  if (!release) {
    throw new Error(`Expected release ${identity.releaseId}.`);
  }
  await ctx.db.patch("contentReleases", release._id, { createdAt });
}

/** Inserts one complete immutable technical content version. */
async function insertHead(
  ctx: MutationCtx,
  identity: TestIdentity,
  contentKey: string,
  index: number,
  artifactHash: string
) {
  await ctx.db.insert("contentHeads", {
    artifactHash,
    compilerConfigHash: TEST_DIGEST,
    contentKey,
    delivery: "public",
    family: "material",
    index,
    locale: "en",
    operation: "upsert",
    projectionHash: TEST_DIGEST,
    projectionJson: testProjectionJson({ contentKey, index }),
    releaseId: identity.releaseId,
    rendererDomain: "mathematics",
    sequence: identity.sequence,
    sourceHash: TEST_DIGEST,
    sourcePath: `packages/corpus/test/${contentKey}/en.mdx`,
  });
}

/** Inserts one immutable technical route binding. */
async function insertBinding(
  ctx: MutationCtx,
  identity: TestIdentity,
  contentKey: string,
  index: number,
  publicPath: string
) {
  await ctx.db.insert("contentBindings", {
    batchHash: TEST_DIGEST,
    batchIndex: 0,
    contentKey,
    index,
    locale: "en",
    operation: "bind",
    publicPath,
    releaseId: identity.releaseId,
    routeJson: testRouteJson({
      contentKey,
      index,
      publicPath,
      releaseId: identity.releaseId,
    }),
    sequence: identity.sequence,
  });
}

/** Seeds old versions, release rows, and artifacts around a protected floor. */
export async function seedCompactionHistory(ctx: MutationCtx) {
  const releases = Array.from({ length: 5 }, (_, index) =>
    compactionIdentity(index + 1)
  );
  for (const [index, release] of releases.entries()) {
    await insertCompletedRelease(
      ctx,
      release,
      releases[index - 1],
      index < 3 ? COMPACTION_OLD_TIME : Date.now()
    );
  }
  const first = releases[0];
  const third = releases[2];
  const fourth = releases[3];
  const fifth = releases[4];
  if (!(first && third && fourth && fifth)) {
    throw new Error("Expected five compaction releases.");
  }
  await insertTestState(ctx, { active: fifth, nextSequence: 6 });
  for (let index = 0; index < 40; index += 1) {
    const contentKey = `test:compact-${index}`;
    await insertHead(
      ctx,
      first,
      contentKey,
      index,
      `sha256:${(index + 100).toString(16).padStart(64, "0")}`
    );
    await insertHead(
      ctx,
      fourth,
      contentKey,
      index,
      `sha256:${(index + 200).toString(16).padStart(64, "0")}`
    );
  }
  await insertHead(ctx, first, "test:anchor", 40, `sha256:${"a".repeat(64)}`);
  await insertHead(ctx, third, "test:anchor", 0, `sha256:${"b".repeat(64)}`);
  await insertBinding(ctx, first, "test:route", 0, "test/route");
  await insertBinding(ctx, fourth, "test:route", 0, "test/route");
  await insertBinding(ctx, first, "test:path-anchor", 1, "test/path-anchor");
  await insertBinding(ctx, third, "test:path-anchor", 0, "test/path-anchor");
  const staleHash = `sha256:${"c".repeat(64)}`;
  const retainedHash = `sha256:${"d".repeat(64)}`;
  await insertHead(ctx, fourth, "test:retained", 41, retainedHash);
  await ctx.db.insert("contentItems", {
    artifactBatchHash: TEST_DIGEST,
    artifactBatchIndex: 0,
    artifactHash: staleHash,
    artifactReady: true,
    contentKey: "test:stale",
    index: 0,
    itemBatchHash: TEST_DIGEST,
    itemBatchIndex: 0,
    itemJson: testUpsertJson({
      artifactHash: staleHash,
      contentKey: "test:stale",
      releaseId: first.releaseId,
    }),
    locale: "en",
    projectionBatchHash: TEST_DIGEST,
    projectionBatchIndex: 0,
    projectionJson: testProjectionJson({ contentKey: "test:stale" }),
    projectionReady: true,
    releaseId: first.releaseId,
    rollbackJson: testRollbackJson({
      contentKey: "test:stale",
      releaseId: first.releaseId,
    }),
    sequence: first.sequence,
    stagedAt: COMPACTION_OLD_TIME,
  });
  for (const [artifactHash, retainUntil] of [
    [staleHash, COMPACTION_OLD_TIME],
    [retainedHash, COMPACTION_OLD_TIME],
    [`sha256:${"e".repeat(64)}`, COMPACTION_OLD_TIME],
    [`sha256:${"f".repeat(64)}`, Date.now() + ROLLBACK_RETENTION_MS],
  ] as const) {
    await ctx.db.insert("contentArtifacts", {
      artifactHash,
      artifactJson: testArtifactJson({ artifactHash }),
      createdAt: COMPACTION_OLD_TIME,
      retainUntil,
    });
  }
}
