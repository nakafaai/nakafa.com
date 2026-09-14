import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
  restoreContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { readTryoutRuntimeRetention } from "@repo/backend/convex/contentRelease/tryout/runtime";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { TEST_DIGEST } from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import type { TestConvex } from "convex-test";
import type { Schema } from "effect";

type SnapshotId = Schema.Schema.Type<typeof Sha256HashSchema>;

export const RETENTION_RELEASE_ID = "release-runtime-retention";
export const RETENTION_MANIFEST_HASH = Sha256HashSchema.make(
  `sha256:${"1".repeat(64)}`
);
export const RETENTION_RESULT_SNAPSHOT = Sha256HashSchema.make(
  `sha256:${"d".repeat(64)}`
);
export const RETENTION_BASE_SNAPSHOT = Sha256HashSchema.make(
  `sha256:${"c".repeat(64)}`
);
export const RETENTION_OTHER_SNAPSHOT = Sha256HashSchema.make(
  `sha256:${"e".repeat(64)}`
);
export const RETENTION_NEWER_SNAPSHOT = Sha256HashSchema.make(
  `sha256:${"f".repeat(64)}`
);

export interface RuntimeRetentionSeed {
  readonly baseSnapshotId?: SnapshotId | null;
  readonly cleanupReleaseId?: string;
  readonly mode?: "replace" | "restore";
  readonly originKind: "git" | "rollback";
  readonly patchColumns?: boolean;
  readonly rendererManifestHash?: string;
  readonly resultSnapshotId?: SnapshotId;
  readonly snapshotId: string;
  readonly withState?: boolean;
}

/** Seeds one retained runtime pair plus the release that may keep it. */
export async function seedRuntimeRetentionRow(
  ctx: MutationCtx,
  facts: RuntimeRetentionSeed
) {
  const resultSnapshotId = facts.resultSnapshotId ?? RETENTION_RESULT_SNAPSHOT;
  const snapshots = {
    ...inheritContentSnapshots(null),
    tryout:
      facts.mode === "restore"
        ? restoreContentSnapshot(
            facts.baseSnapshotId ?? RETENTION_BASE_SNAPSHOT,
            facts.resultSnapshotId ?? RETENTION_NEWER_SNAPSHOT
          )
        : replaceContentSnapshot({
            baseSnapshotId: facts.baseSnapshotId ?? null,
            resultSnapshotId,
            rowCount: 1,
            rowDigest: resultSnapshotId,
          }),
  };
  if (facts.withState !== false) {
    await insertZeroRelease(ctx, {
      manifestHash: RETENTION_MANIFEST_HASH,
      releaseId: RETENTION_RELEASE_ID,
      sequence: 1,
      originReleaseId:
        facts.originKind === "rollback" ? "release-runtime-base" : undefined,
      ownership: { base: [], result: [] },
      role: "candidate",
      snapshots,
      status: "completed",
    });
    await insertTestState(ctx, {
      active: {
        manifestHash: RETENTION_MANIFEST_HASH,
        releaseId: RETENTION_RELEASE_ID,
        sequence: 1,
      },
      nextSequence: 2,
    });
    if (facts.patchColumns) {
      const release = await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", RETENTION_RELEASE_ID)
        )
        .unique();
      if (!release) {
        throw new Error("Expected retained runtime release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        originKind: undefined,
        rendererManifestHash: undefined,
        snapshotTransitions: undefined,
      });
    }
  }
  return ctx.db.insert("tryoutRuntimeBundles", {
    bundleHash: "technical",
    bundleJson: "{}",
    cleanupReleaseId: facts.cleanupReleaseId,
    createdAt: 0,
    rendererJson: "{}",
    rendererManifestHash: facts.rendererManifestHash ?? TEST_DIGEST,
    snapshotId: facts.snapshotId,
    sourceGitSha: "technical",
    sourceManifestHash: RETENTION_MANIFEST_HASH,
    sourceReleaseId: RETENTION_RELEASE_ID,
  });
}

/** Inserts one minimal active attempt bound to a permanent runtime pair. */
export async function insertRetentionAttempt(
  ctx: MutationCtx,
  bundleId: Doc<"tryoutRuntimeBundles">["_id"]
) {
  await ctx.db.insert("tryoutAttempts", {
    accessEndsAt: 1,
    accessSourceKind: "free",
    appLocale: "id",
    attemptNumber: 1,
    completedAt: null,
    completedSectionKeys: [],
    countsForCompetition: false,
    countryKey: "indonesia",
    endReason: null,
    examKey: "snbt",
    expiresAt: 2,
    lastActivityAt: 1,
    scoreStatus: "official",
    scoringStrategy: "irt",
    sectionSnapshots: [],
    setIdentity: "set:technical",
    setKey: "set-1",
    setPublicPath: "try-out/technical",
    snapshotReleaseId: RETENTION_RELEASE_ID,
    startedAt: 1,
    status: "in-progress",
    totalCorrect: 0,
    totalQuestions: 1,
    trackKey: "2027",
    tryoutBundleHash: "technical",
    tryoutBundleId: bundleId,
    tryoutSnapshotId: RETENTION_RESULT_SNAPSHOT,
    userId: await ctx.db.insert("users", {
      authId: "auth-retention",
      credits: 0,
      creditsResetAt: 1,
      email: "retention@nakafa.test",
      name: "Retention Tester",
      plan: "pro",
    }),
  });
}

/** Reads retention for one seeded permanent pair through the real seam. */
export function readRuntimeRetention(
  t: TestConvex<typeof schema>,
  rowId: Doc<"tryoutRuntimeBundles">["_id"]
) {
  return t.mutation(async (ctx) => {
    const row = await ctx.db.get("tryoutRuntimeBundles", rowId);
    if (!row) {
      throw new Error("Expected retained runtime pair.");
    }
    return runConvexProgram(readTryoutRuntimeRetention(ctx, row));
  });
}
