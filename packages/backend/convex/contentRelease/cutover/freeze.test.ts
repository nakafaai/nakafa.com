import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { freezeProgram } from "@repo/backend/convex/contentRelease/cutover/freeze";
import {
  AUDITED_ACTIVE_RELEASE_ID,
  RETAINED_TRYOUT_RELEASES,
  RETAINED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { finalizeRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/finalize";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content-state";
import {
  prepareRetainedTryoutHistory,
  provideHistoryTestTrust,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/freeze", () => {
  it("returns the immutable receipt after the current drain completed", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const fixture = await seedRetainedTryoutHistory(ctx);
      await prepareRetainedTryoutHistory(ctx, fixture);
      await runConvexProgram(
        provideHistoryTestTrust(
          finalizeRetainedTryoutHistory(ctx, fixture.plan)
        )
      );
      const sourceRows = [
        ...(await ctx.db.query("tryoutCatalog").collect()),
        ...(await ctx.db.query("tryoutPlacements").collect()),
      ];
      for (const row of sourceRows) {
        await ctx.db.delete(row._id);
      }
      const publicationState = await ctx.db.query("contentState").first();
      if (publicationState) {
        await ctx.db.delete(publicationState._id);
      }
      await insertCutoverState(ctx, "complete");
      return runConvexProgram(
        provideHistoryTestTrust(freezeProgram(ctx, fixture.plan))
      );
    });

    expect(result).toMatchObject({
      attempts: 2,
      frozen: true,
      markers: 2,
      placementRows: 2,
    });
  });

  it("rolls back before history reads when the audited pointer changed", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedQuiescentPublication(ctx);
      await insertCutoverState(ctx, "freeze-armed");
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          freezeProgram(ctx, retainedTryoutHistoryPlan).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              contentKeyResolver
            )
          )
        )
      )
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("changed after audit"),
      },
    });
    await expect(
      t.run(async (ctx) => ({
        cutover: await ctx.db.query("contentCutoverState").unique(),
        state: await ctx.db.query("contentState").unique(),
      }))
    ).resolves.toMatchObject({
      cutover: { phase: "freeze-armed" },
      state: { nextSequence: 3 },
    });
  });
});

async function insertCutoverState(
  ctx: MutationCtx,
  phase: "complete" | "freeze-armed"
) {
  await ctx.db.insert("contentCutoverState", {
    auditedActiveReleaseId: AUDITED_ACTIVE_RELEASE_ID,
    auditedActiveSequence: 1,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
    auditedNextSequence: 2,
    currentDeleted: 0,
    currentTableDeleted: 0,
    currentTableIndex: 0,
    currentTablePreserved: 0,
    inventoryVersion: "production-2026-08-13",
    key: "phase1",
    legacyDeleted: 0,
    legacyTableDeleted: 0,
    legacyTableIndex: 16,
    phase,
    updatedAt: 1,
  });
}

async function seedQuiescentPublication(ctx: MutationCtx) {
  const identity = {
    manifestHash: `sha256:${"d".repeat(64)}`,
    releaseId: AUDITED_ACTIVE_RELEASE_ID,
    sequence: 1,
  };
  await insertZeroRelease(ctx, {
    ...identity,
    ownership: { base: [], result: [] },
    role: "candidate",
    status: "completed",
  });
  for (let index = 0; index < 25; index += 1) {
    await insertZeroRelease(ctx, {
      manifestHash: `sha256:${index.toString(16).padStart(64, "0")}`,
      ownership: { base: [], result: [] },
      releaseId: `detached-${index}`,
      role: "candidate",
      sequence: index + 2,
      status: "aborted",
    });
  }
  await insertTestState(ctx, {
    active: identity,
    article: identity,
    material: identity,
    nextSequence: 3,
    search: identity,
  });
  await ctx.db.insert("contentSnapshots", {
    createdAt: 1,
    family: "tryout",
    retainUntil: 1,
    snapshotId: RETAINED_TRYOUT_SNAPSHOT_ID,
    snapshotJson: "{}",
    verifiedAt: 1,
  });
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
}
