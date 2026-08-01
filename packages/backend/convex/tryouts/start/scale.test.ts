import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import {
  TRYOUT_START_COUNTRY as COUNTRY,
  TRYOUT_START_EXAM as EXAM,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_SET as SET,
  TRYOUT_START_TRACK as TRACK,
} from "@repo/backend/test/tryout-source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout-start";
import { describe, expect, it, vi } from "vitest";

const startArgs: StartAttemptArgs = {
  countryKey: COUNTRY,
  examKey: EXAM,
  locale: "id",
  setKey: SET,
  trackKey: TRACK,
};

describe("tryouts/start/scale", () => {
  it("uses the published local scale before signed ownership activates", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-local-scale",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        scoringStrategy: "irt",
        userId: identity.userId,
        visibility: "visible",
      });
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW,
        questionCount: 1,
        status: "official",
        tryoutSetId: fixture.tryoutSetId,
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected one content state row.");
      }
      await ctx.db.patch("contentState", state._id, {
        activeManifestHash: undefined,
        activeReleaseId: undefined,
        activeSequence: undefined,
      });
      return { identity, scaleVersionId };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    const result = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      startArgs
    );
    const attempt = await t.query((ctx) => ctx.db.get(result.attemptId));

    expect(attempt?.scaleVersionId).toBe(seeded.scaleVersionId);
    expect(attempt).not.toHaveProperty("tryoutSnapshotId");
  });

  it("requires the IRT scale bound to the exact signed snapshot", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-scale",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        scoringStrategy: "irt",
        userId: identity.userId,
        visibility: "visible",
      });
      await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW + 1,
        questionCount: 1,
        setIdentity: fixture.setIdentity,
        status: "official",
        tryoutSetId: fixture.tryoutSetId,
        tryoutSnapshotId: "stale-snapshot",
      });
      return { fixture, identity };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, startArgs)
    ).rejects.toThrow("TRYOUT_IRT_SCALE_REQUIRED");

    const scaleVersionId = await t.mutation((ctx) =>
      ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW,
        questionCount: 1,
        setIdentity: seeded.fixture.setIdentity,
        status: "official",
        tryoutSetId: seeded.fixture.tryoutSetId,
        tryoutSnapshotId: seeded.fixture.snapshotId,
      })
    );
    const result = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      startArgs
    );
    const attempt = await t.query((ctx) => ctx.db.get(result.attemptId));

    expect(attempt?.scaleVersionId).toBe(scaleVersionId);
  });
});
