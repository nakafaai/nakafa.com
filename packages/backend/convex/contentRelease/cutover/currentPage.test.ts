import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { deleteCurrentPage } from "@repo/backend/convex/contentRelease/cutover/currentPage";
import {
  CURRENT_INVENTORY,
  RETAINED_TRYOUT_RELEASES,
  RETAINED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const hashes = Array.from(
  { length: 5 },
  (_, index) => `sha256:${index.toString(16).padStart(64, "0")}`
);

describe("contentRelease/cutover/currentPage", () => {
  it("deletes only unreferenced artifacts across exact retry pages", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(seedArtifactDrain);

    const first = await t.mutation((ctx) =>
      runConvexProgram(deleteCurrentPage(ctx, 4, 5))
    );
    const completed = await t.mutation((ctx) =>
      runConvexProgram(deleteCurrentPage(ctx, 4, 5))
    );
    const result = await t.query(async (ctx) => ({
      artifacts: await ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash")
        .take(5),
      history: await ctx.db.query("tryoutHistoryRows").take(3),
      state: await ctx.db.query("contentCutoverState").unique(),
      user: await ctx.db.get("users", userId),
    }));

    expect(first).toEqual({
      complete: false,
      deleted: 0,
      phase: "draining-current",
      preserved: 4,
      table: "contentArtifacts",
    });
    expect(completed).toEqual({
      complete: false,
      deleted: 1,
      phase: "draining-current",
      preserved: 0,
      table: "contentSnapshots",
    });
    expect(result.artifacts.map(({ artifactHash }) => artifactHash)).toEqual(
      hashes.slice(0, 4)
    );
    expect(result.history).toHaveLength(2);
    expect(result.state).toMatchObject({
      currentDeleted: 1,
      currentTableIndex: CURRENT_INVENTORY.length + 1,
      phase: "draining-current",
    });
    expect(result.user).toMatchObject({ email: "retained@example.com" });
  });

  it("deletes only nonretained snapshots and preserves both bundles", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(seedSnapshotDrain);

    await expect(
      t.mutation((ctx) => runConvexProgram(deleteCurrentPage(ctx)))
    ).resolves.toEqual({
      complete: false,
      deleted: 3,
      phase: "draining-current",
      preserved: 1,
      table: "proof",
    });
    const result = await t.query(async (ctx) => ({
      bundles: await ctx.db.query("tryoutBundles").take(3),
      snapshots: await ctx.db.query("contentSnapshots").take(2),
      state: await ctx.db.query("contentCutoverState").unique(),
      user: await ctx.db.get("users", userId),
    }));

    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0]).toMatchObject({
      family: "tryout",
      snapshotId: RETAINED_TRYOUT_SNAPSHOT_ID,
    });
    expect(result.bundles.map(({ releaseId }) => releaseId).sort()).toEqual(
      RETAINED_TRYOUT_RELEASES.map(({ releaseId }) => releaseId).sort()
    );
    expect(result.state).toMatchObject({
      currentDeleted: 3,
      currentTableIndex: CURRENT_INVENTORY.length + 2,
      phase: "draining-current",
    });
    expect(result.user).toMatchObject({ email: "retained@example.com" });
  });
});

async function seedArtifactDrain(ctx: MutationCtx) {
  for (const [index, artifactHash] of hashes.entries()) {
    await ctx.db.insert("contentArtifacts", {
      artifactHash,
      artifactJson: `{"index":${index}}`,
      createdAt: 1,
      retainUntil: 1,
    });
  }
  for (const index of [0, 2]) {
    const questionArtifactHash = hashes[index];
    const answerArtifactHash = hashes[index + 1];
    if (!(questionArtifactHash && answerArtifactHash)) {
      throw new Error("Expected retained artifact hash fixture.");
    }
    await ctx.db.insert("tryoutHistoryRows", {
      answerArtifactHash,
      index,
      questionArtifactHash,
      rowHash: `row-${index}`,
      rowJson: "{}",
      rowKind: "placement",
      snapshotId: RETAINED_TRYOUT_SNAPSHOT_ID,
    });
  }
  const userId = await ctx.db.insert("users", {
    authId: "retained-user",
    credits: 0,
    creditsResetAt: 1,
    email: "retained@example.com",
    name: "Retained User",
    plan: "free",
  });
  await ctx.db.insert("contentCutoverState", {
    auditedActiveReleaseId: "active-release",
    auditedActiveSequence: 1,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
    auditedNextSequence: 2,
    currentDeleted: 0,
    currentTableDeleted: 0,
    currentTableIndex: CURRENT_INVENTORY.length,
    currentTablePreserved: 0,
    inventoryVersion: "production-2026-08-13",
    key: "phase1",
    legacyDeleted: 0,
    legacyTableDeleted: 0,
    legacyTableIndex: 16,
    phase: "frozen",
    updatedAt: 1,
  });
  return userId;
}

async function seedSnapshotDrain(ctx: MutationCtx) {
  const snapshots = [
    { family: "tryout", snapshotId: RETAINED_TRYOUT_SNAPSHOT_ID },
    { family: "program", snapshotId: `sha256:${"a".repeat(64)}` },
    { family: "quran", snapshotId: `sha256:${"b".repeat(64)}` },
    { family: "program", snapshotId: `sha256:${"c".repeat(64)}` },
  ] as const;
  for (const snapshot of snapshots) {
    await ctx.db.insert("contentSnapshots", {
      createdAt: 1,
      family: snapshot.family,
      retainUntil: 1,
      snapshotId: snapshot.snapshotId,
      snapshotJson: "{}",
      verifiedAt: 1,
    });
  }
  for (const [index, release] of RETAINED_TRYOUT_RELEASES.entries()) {
    await ctx.db.insert("tryoutBundles", {
      createdAt: 1,
      index,
      manifestHash: release.manifestHash,
      releaseId: release.releaseId,
      releaseJson: "{}",
      rendererJson: "{}",
      snapshotId: RETAINED_TRYOUT_SNAPSHOT_ID,
    });
  }
  const userId = await ctx.db.insert("users", {
    authId: "retained-snapshot-user",
    credits: 0,
    creditsResetAt: 1,
    email: "retained@example.com",
    name: "Retained User",
    plan: "free",
  });
  await ctx.db.insert("contentCutoverState", {
    auditedActiveReleaseId: "active-release",
    auditedActiveSequence: 1,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
    auditedNextSequence: 2,
    currentDeleted: 0,
    currentTableDeleted: 0,
    currentTableIndex: CURRENT_INVENTORY.length + 1,
    currentTablePreserved: 0,
    inventoryVersion: "production-2026-08-13",
    key: "phase1",
    legacyDeleted: 0,
    legacyTableDeleted: 0,
    legacyTableIndex: 16,
    phase: "draining-current",
    updatedAt: 1,
  });
  return userId;
}
