import { describe, expect, it, vi } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import { insertTestTryoutRuntimeBundle } from "@repo/backend/test/runtime/bundle";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  TRYOUT_START_COUNTRY as COUNTRY,
  TRYOUT_START_EXAM as EXAM,
  makeTryoutStartCatalog,
  makeTryoutStartPlacement,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_SET as SET,
  TRYOUT_START_TRACK as TRACK,
} from "@repo/backend/test/tryout/source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout/start";

const startArgs: StartAttemptArgs = {
  countryKey: COUNTRY,
  examKey: EXAM,
  locale: "id",
  setKey: SET,
  trackKey: TRACK,
};

describe("tryouts/start/scale", () => {
  it("publishes one complete scale for every signed snapshot", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const firstIdentity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-first-scale",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        scoringStrategy: "irt",
        userId: firstIdentity.userId,
        visibility: "visible",
      });
      return { firstIdentity, fixture };
    });
    const firstAuthed = t.withIdentity({
      sessionId: seeded.firstIdentity.sessionId,
      subject: seeded.firstIdentity.authUserId,
    });
    const firstResult = await firstAuthed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      startArgs
    );
    const second = await t.mutation(async (ctx) => {
      const [release, state] = await Promise.all([
        ctx.db.query("contentReleases").unique(),
        ctx.db.query("contentState").unique(),
      ]);
      if (!(release && state)) {
        throw new Error("Expected the first active technical release.");
      }
      await ctx.db.delete("contentReleases", release._id);
      await ctx.db.delete("contentState", state._id);

      const locales = ACTIVE_APP_LOCALE_CODES;
      const catalog = locales.flatMap((locale) =>
        makeTryoutStartCatalog(locale, "visible", "irt").map((row) =>
          locale === "en" && row.kind === "set"
            ? { ...row, title: "Set one" }
            : row
        )
      );
      const placements = locales.map(makeTryoutStartPlacement);
      const snapshotId = await activateTryoutSnapshot(ctx, {
        catalog,
        placements,
        releaseId: "release-test-second-scale",
      });
      await insertTestTryoutRuntimeBundle(ctx, snapshotId);
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-second-scale",
      });
      return { identity, snapshotId };
    });
    const secondAuthed = t.withIdentity({
      sessionId: second.identity.sessionId,
      subject: second.identity.authUserId,
    });
    const secondResult = await secondAuthed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      startArgs
    );

    const proof = await t.query(async (ctx) => {
      const firstAttempt = await ctx.db.get(firstResult.attemptId);
      const secondAttempt = await ctx.db.get(secondResult.attemptId);
      if (!(firstAttempt?.scaleVersionId && secondAttempt?.scaleVersionId)) {
        throw new Error("Expected both signed attempts to freeze a scale.");
      }
      const firstScaleVersionId = firstAttempt.scaleVersionId;
      const secondScaleVersionId = secondAttempt.scaleVersionId;

      const firstScale = await ctx.db.get(firstScaleVersionId);
      const secondScale = await ctx.db.get(secondScaleVersionId);
      const firstItems = await ctx.db
        .query("irtScaleItems")
        .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
          query.eq("scaleVersionId", firstScaleVersionId)
        )
        .collect();
      const secondItems = await ctx.db
        .query("irtScaleItems")
        .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
          query.eq("scaleVersionId", secondScaleVersionId)
        )
        .collect();
      return { firstItems, firstScale, secondItems, secondScale };
    });

    expect(proof.firstScale?.tryoutSnapshotId).toBe(seeded.fixture.snapshotId);
    expect(proof.secondScale?.tryoutSnapshotId).toBe(second.snapshotId);
    expect(proof.secondScale?._id).not.toBe(proof.firstScale?._id);
    expect(proof.firstItems).toHaveLength(1);
    expect(proof.secondItems).toHaveLength(1);
    expect(proof.secondItems[0]?.placementRowHash).toBe(
      proof.firstItems[0]?.placementRowHash
    );
  });

  it("rejects an incomplete scale bound to the exact snapshot", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-incomplete-scale",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        scoringStrategy: "irt",
        userId: identity.userId,
        visibility: "visible",
      });
      await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW,
        questionCount: 1,
        setIdentity: fixture.setIdentity,
        status: "official",
        tryoutSnapshotId: fixture.snapshotId,
      });
      return { identity };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, startArgs)
    ).rejects.toThrow("TRYOUT_IRT_SCALE_REQUIRED");
  });

  it("excludes migrated history from live scale selection", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-history-scale",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        scoringStrategy: "irt",
        userId: identity.userId,
        visibility: "visible",
      });
      const historyId = await ctx.db.insert("irtScaleVersions", {
        history: true,
        model: "2pl",
        publishedAt: NOW - 1,
        questionCount: 1,
        setIdentity: fixture.setIdentity,
        status: "official",
        tryoutSnapshotId: fixture.snapshotId,
      });
      return { historyId, identity };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    const result = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      startArgs
    );
    const proof = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(result.attemptId),
      scales: await ctx.db.query("irtScaleVersions").collect(),
    }));

    expect(proof.scales).toHaveLength(2);
    expect(proof.attempt?.scaleVersionId).not.toBe(seeded.historyId);
    expect(
      proof.scales.find(({ _id }) => _id === proof.attempt?.scaleVersionId)
    ).not.toHaveProperty("history");
  });
});
