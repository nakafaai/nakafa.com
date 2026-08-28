import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";

export const ABORT_MIGRATION_ID = "tryout-history-abort-test";
export const ABORT_SOURCE_SNAPSHOT = retainedTryoutHistoryPlan.snapshotId;
export const ABORT_TARGET_SNAPSHOT = `sha256:${"1".repeat(64)}`;
export const ABORT_TARGET_BUNDLE = `sha256:${"2".repeat(64)}`;
export const ABORT_OWNED_ARTIFACT = `sha256:${"3".repeat(64)}`;
export const ABORT_SHARED_ARTIFACT = `sha256:${"4".repeat(64)}`;
const CATALOG_HASH = `sha256:${"5".repeat(64)}`;
const PLACEMENT_HASH = `sha256:${"6".repeat(64)}`;

/** Inserts one invisible pending root with no staged target bytes. */
export function seedPendingAbort(ctx: MutationCtx) {
  return ctx.db.insert("tryoutHistoryMigrations", {
    artifactMapCount: 0,
    catalogMapCount: 0,
    createdAt: 1,
    migrationId: ABORT_MIGRATION_ID,
    phase: "staging",
    placementMapCount: 0,
    sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
    target: { kind: "pending" },
    updatedAt: 1,
  });
}

/** Inserts owned target rows plus one preexisting shared artifact. */
export async function seedOwnedAbort(ctx: MutationCtx) {
  await ctx.db.insert("contentArtifacts", {
    artifactHash: ABORT_OWNED_ARTIFACT,
    artifactJson: "owned-artifact",
    createdAt: 1,
    retainUntil: Number.MAX_SAFE_INTEGER,
  });
  await ctx.db.insert("contentArtifacts", {
    artifactHash: ABORT_SHARED_ARTIFACT,
    artifactJson: "shared-artifact",
    createdAt: 1,
    retainUntil: Number.MAX_SAFE_INTEGER,
  });
  await ctx.db.insert("tryoutCatalog", {
    appLocale: "en",
    assetId: "asset:abort:catalog",
    identity: "catalog:abort",
    index: 0,
    kind: "country",
    order: 0,
    rowHash: CATALOG_HASH,
    rowJson: "owned-catalog",
    snapshotId: ABORT_TARGET_SNAPSHOT,
  });
  await ctx.db.insert("tryoutPlacements", {
    answerArtifactHash: ABORT_SHARED_ARTIFACT,
    answerArtifactLocale: "en",
    appLocale: "en",
    contentHash: "content-abort",
    countryKey: "country",
    deliveryLanguage: "en",
    examKey: "exam",
    identity: "placement:abort",
    index: 1,
    questionArtifactHash: ABORT_OWNED_ARTIFACT,
    questionArtifactLocale: "en",
    questionOrder: 0,
    rowHash: PLACEMENT_HASH,
    rowJson: "owned-placement",
    sectionKey: "section",
    setKey: "set",
    snapshotId: ABORT_TARGET_SNAPSHOT,
    trackKey: "track",
  });
  await ctx.db.insert("contentSnapshots", {
    createdAt: 1,
    family: "tryout",
    retainUntil: Number.MAX_SAFE_INTEGER,
    snapshotId: ABORT_TARGET_SNAPSHOT,
    snapshotJson: "owned-snapshot",
  });
  await ctx.db.insert("tryoutRuntimeBundles", {
    bundleHash: ABORT_TARGET_BUNDLE,
    bundleJson: "owned-runtime",
    cleanupReleaseId: "tryout-history-abort-target",
    createdAt: 1,
    rendererJson: "owned-renderer",
    rendererManifestHash: `sha256:${"7".repeat(64)}`,
    snapshotId: ABORT_TARGET_SNAPSHOT,
    sourceGitSha: "a".repeat(40),
    sourceManifestHash: `sha256:${"8".repeat(64)}`,
    sourceReleaseId: "tryout-history-abort-target",
  });
  await seedOwnedMaps(ctx);
  await ctx.db.insert("tryoutHistoryMigrations", {
    artifactMapCount: 2,
    catalogMapCount: 1,
    createdAt: 1,
    migrationId: ABORT_MIGRATION_ID,
    phase: "staging",
    placementMapCount: 1,
    sourceSnapshotId: ABORT_SOURCE_SNAPSHOT,
    target: {
      bundleCreated: true,
      bundleHash: ABORT_TARGET_BUNDLE,
      kind: "staged",
      snapshotCreated: true,
      snapshotId: ABORT_TARGET_SNAPSHOT,
    },
    updatedAt: 1,
  });
}

/** Inserts exact map identities and ownership for the staged target. */
async function seedOwnedMaps(ctx: MutationCtx) {
  const maps = [
    {
      identity: "catalog:abort",
      index: 0,
      kind: "catalog" as const,
      newHash: CATALOG_HASH,
      oldHash: `sha256:${"9".repeat(64)}`,
      targetCreated: true,
    },
    {
      identity: "placement:abort",
      index: 1,
      kind: "placement" as const,
      newHash: PLACEMENT_HASH,
      oldHash: `sha256:${"a".repeat(64)}`,
      targetCreated: true,
    },
    {
      identity: "artifact:owned",
      index: 0,
      kind: "artifact" as const,
      newHash: ABORT_OWNED_ARTIFACT,
      oldHash: `sha256:${"b".repeat(64)}`,
      targetCreated: true,
    },
    {
      identity: "artifact:shared",
      index: 1,
      kind: "artifact" as const,
      newHash: ABORT_SHARED_ARTIFACT,
      oldHash: `sha256:${"c".repeat(64)}`,
      targetCreated: false,
    },
  ];
  for (const map of maps) {
    await ctx.db.insert("tryoutHistoryMigrationMaps", {
      ...map,
      migrationId: ABORT_MIGRATION_ID,
    });
  }
}
