import { assert, describe, expect, it } from "@effect/vitest";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { retireAttemptPage } from "@repo/backend/convex/contentRelease/retire/attempt";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { seedRetirementAttempt } from "@repo/backend/test/content/retire";
import { makeFunctionReference } from "convex/server";

describe("contentRelease/retire/attempt", () => {
  it("deletes one reviewed attempt in bounded pages while preserving the user and publication", async () => {
    const t = createConvexTestWithBetterAuth();
    const plan = await t.mutation(seedRetirementAttempt);
    let complete = false;
    for (let page = 0; page < 16 && !complete; page += 1) {
      ({ complete } = await t.mutation(
        makeFunctionReference<"mutation">("contentRelease/retire:attempt"),
        { plan }
      ));
    }
    expect(complete).toBe(true);
    await expect(
      t.mutation((ctx) => runConvexProgram(retireAttemptPage(ctx, plan)))
    ).resolves.toEqual({ complete: true });
    const remaining = await t.query(async (ctx) => ({
      attempts: await ctx.db.query("tryoutAttempts").collect(),
      placements: await ctx.db.query("tryoutAttemptPlacements").collect(),
      progress: await ctx.db.query("tryoutSetProgress").collect(),
      runtime: await ctx.db.get("tryoutRuntimeBundles", plan.runtimeId),
      sections: await ctx.db.query("tryoutSectionAttempts").collect(),
      state: await ctx.db.query("contentState").unique(),
      users: await ctx.db.query("users").collect(),
    }));
    expect(remaining).toMatchObject({
      attempts: [],
      placements: [],
      progress: [],
      runtime: null,
      sections: [],
      state: { activeSequence: 5 },
    });
    expect(remaining.users).toHaveLength(1);
  });

  it("rejects changed identity, paid access, and active attempts before deleting children", async () => {
    const t = createConvexTestWithBetterAuth();
    const plan = await t.mutation(seedRetirementAttempt);
    for (const patch of [
      { status: "in-progress" as const },
      {
        status: "completed" as const,
        accessSubscriptionId: "paid-subscription",
      },
      {
        accessSubscriptionId: undefined,
        accessSourceKind: "subscription" as const,
      },
      { accessSourceKind: "free" as const, countsForCompetition: true },
      { countsForCompetition: false, accessSourceKind: "competition" as const },
      { accessSourceKind: "free" as const, startedAt: plan.startedAt + 1 },
    ]) {
      await t.mutation((ctx) =>
        ctx.db.patch("tryoutAttempts", plan.attemptId, patch)
      );
      await expect(
        t.mutation((ctx) => runConvexProgram(retireAttemptPage(ctx, plan)))
      ).rejects.toThrow("completed unpaid snapshot");
    }
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          retireAttemptPage(ctx, { ...plan, bundleHash: "changed" })
        )
      )
    ).rejects.toThrow("runtime changed identity");
    expect(
      await t.query((ctx) => ctx.db.query("tryoutAttemptPlacements").collect())
    ).toHaveLength(1);
  });

  it("preserves another attempt sharing the runtime and its compact progress", async () => {
    const t = createConvexTestWithBetterAuth();
    const plan = await t.mutation(seedRetirementAttempt);
    await t.mutation(async (ctx) => {
      const attempt = await ctx.db.get("tryoutAttempts", plan.attemptId);
      assert.ok(attempt);
      const { _creationTime, _id, ...values } = attempt;
      await ctx.db.insert("tryoutAttempts", { ...values, attemptNumber: 2 });
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(retireAttemptPage(ctx, plan)))
    ).rejects.toThrow("Another try-out attempt");
    expect(
      await t.query((ctx) => ctx.db.query("tryoutSetProgress").collect())
    ).toHaveLength(1);
  });

  it("preserves progress shared with another runtime and refuses a slot-owned snapshot", async () => {
    const t = createConvexTestWithBetterAuth();
    const plan = await t.mutation(seedRetirementAttempt);
    await t.mutation(async (ctx) => {
      const attempt = await ctx.db.get("tryoutAttempts", plan.attemptId);
      const runtime = await ctx.db.get("tryoutRuntimeBundles", plan.runtimeId);
      assert.ok(attempt && runtime);
      const {
        _creationTime: runtimeCreated,
        _id: runtimeId,
        ...runtimeValues
      } = runtime;
      const otherRuntimeId = await ctx.db.insert("tryoutRuntimeBundles", {
        ...runtimeValues,
        bundleHash: "another-bundle",
      });
      const { _creationTime, _id, ...values } = attempt;
      await ctx.db.insert("tryoutAttempts", {
        ...values,
        tryoutBundleId: otherRuntimeId,
        attemptNumber: 2,
      });
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(retireAttemptPage(ctx, plan)))
    ).rejects.toThrow("progress shared");
    await t.mutation(async (ctx) => {
      const active = await ctx.db
        .query("contentReleases")
        .withIndex("by_sequence", (q) => q.eq("sequence", 5))
        .unique();
      const runtime = await ctx.db.get("tryoutRuntimeBundles", plan.runtimeId);
      assert.ok(active && runtime);
      const release = await runConvexProgram(
        decodeReleaseJson(active.releaseJson)
      );
      await ctx.db.patch("tryoutRuntimeBundles", runtime._id, {
        rendererManifestHash: release.manifest.rendererManifestHash,
      });
      await ctx.db.patch("contentReleases", active._id, {
        releaseJson: JSON.stringify({
          ...release,
          manifest: {
            ...release.manifest,
            snapshots: {
              ...release.manifest.snapshots,
              tryout: {
                ...release.manifest.snapshots.tryout,
                baseSnapshotId: runtime.snapshotId,
                resultSnapshotId: runtime.snapshotId,
              },
            },
          },
        }),
      });
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(retireAttemptPage(ctx, plan)))
    ).rejects.toThrow("publication slot");
  });
});
