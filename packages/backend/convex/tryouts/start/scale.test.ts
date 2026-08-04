import { api, internal } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import { makeTryoutMigrationArgs } from "@repo/backend/test/tryout-migration";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
import {
  TRYOUT_START_COUNTRY as COUNTRY,
  TRYOUT_START_EXAM as EXAM,
  makeTryoutStartCatalog,
  makeTryoutStartPlacement,
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
  it("uses the local scale after signed ownership rolls back", async () => {
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
      await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW + 1,
        questionCount: 1,
        setIdentity: fixture.setIdentity,
        status: "official",
        tryoutSetId: fixture.tryoutSetId,
        tryoutSnapshotId: fixture.snapshotId,
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
    const migrationArgs = makeTryoutMigrationArgs(seeded.fixture.snapshotId);
    const migrationResults = [
      await t.mutation(
        internal.tryouts.migrations.item.migrateItems,
        migrationArgs
      ),
      await t.mutation(
        internal.tryouts.migrations.calibration.migrateRuns,
        migrationArgs
      ),
      await t.mutation(
        internal.tryouts.migrations.scale.migrateScales,
        migrationArgs
      ),
    ];

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

      const locales = ["en", "id"] as const;
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
    expect(migrationResults.every(({ changed }) => changed === 0)).toBe(true);
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
        tryoutSetId: fixture.tryoutSetId,
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
});
