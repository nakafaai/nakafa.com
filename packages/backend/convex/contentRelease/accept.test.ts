import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const CANDIDATE = {
  manifestHash: `sha256:${"3".repeat(64)}`,
  releaseId: "release-accepted",
  sequence: 1,
} satisfies TestIdentity;
const RECOVERY = {
  manifestHash: `sha256:${"4".repeat(64)}`,
  releaseId: "release-retained",
  sequence: 2,
} satisfies TestIdentity;

const accept = internal.contentRelease.accept.accept;

/** Seeds one active candidate with its exact verified retained inverse. */
async function seedAcceptedState(
  ctx: Parameters<typeof insertTestState>[0],
  recovery = RECOVERY
) {
  await insertZeroRelease(ctx, {
    ...CANDIDATE,
    role: "candidate",
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...recovery,
    base: CANDIDATE,
    originReleaseId: CANDIDATE.releaseId,
    role: "recovery",
    status: "verified",
  });
  await insertTestState(ctx, {
    active: CANDIDATE,
    nextSequence: recovery.sequence + 1,
    recovery,
  });
}

describe("contentRelease/accept", () => {
  it("discards the retained inverse and replays after active advancement", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedAcceptedState(ctx));

    const completed = await t.mutation(accept, {
      recoveryId: RECOVERY.releaseId,
      releaseId: CANDIDATE.releaseId,
    });
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        activeManifestHash: `sha256:${"5".repeat(64)}`,
        activeReleaseId: "release-later",
        activeSequence: 3,
      });
    });
    const replayed = await t.mutation(accept, {
      recoveryId: RECOVERY.releaseId,
      releaseId: CANDIDATE.releaseId,
    });
    const stored = await t.run(async (ctx) => ({
      recovery: await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (query) =>
          query.eq("releaseId", RECOVERY.releaseId)
        )
        .unique(),
      state: await ctx.db.query("contentState").unique(),
    }));

    expect(completed).toEqual({
      complete: true,
      processedItems: 0,
      releaseId: RECOVERY.releaseId,
      totalItems: 0,
    });
    expect(replayed).toEqual(completed);
    expect(stored.recovery?.status).toBe("aborted");
    expect(stored.state?.recoveryReleaseId).toBeUndefined();
  });

  it("requires the exact current active and retained slots before abort", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedAcceptedState(ctx));
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        activeReleaseId: "release-other",
      });
    });

    await expect(
      t.mutation(accept, {
        recoveryId: RECOVERY.releaseId,
        releaseId: CANDIDATE.releaseId,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });

  it("rejects an unrelated terminal aborted release", async () => {
    const t = convexTest(schema, convexModules);
    const unrelated = { ...RECOVERY, releaseId: "release-unrelated" };
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...CANDIDATE,
        role: "candidate",
        status: "completed",
      });
      await insertZeroRelease(ctx, {
        ...unrelated,
        base: CANDIDATE,
        originReleaseId: "release-other",
        role: "recovery",
        status: "aborted",
      });
      await insertTestState(ctx, { active: CANDIDATE, nextSequence: 3 });
    });

    await expect(
      t.mutation(accept, {
        recoveryId: unrelated.releaseId,
        releaseId: CANDIDATE.releaseId,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
