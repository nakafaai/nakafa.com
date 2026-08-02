import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { tryoutEntitlementSourceKindCompetition } from "@repo/backend/convex/tryoutAccess/schema";
import { insertTryoutAttempt } from "@repo/backend/test/tryout-runtime";
import {
  TRYOUT_START_COUNTRY as COUNTRY,
  TRYOUT_START_EXAM as EXAM,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_SECTION as SECTION,
  TRYOUT_START_SET as SET,
  TRYOUT_START_TRACK as TRACK,
} from "@repo/backend/test/tryout-source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout-start";
import { describe, expect, it, vi } from "vitest";

describe("tryouts/mutations/attempts", () => {
  it("keeps local attempt creation available before signed ownership activates", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-local",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        userId: identity.userId,
        visibility: "visible",
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
      return { fixture, identity };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    const result = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: COUNTRY,
        examKey: EXAM,
        locale: "id",
        setKey: SET,
        trackKey: TRACK,
      }
    );
    const runtime = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(result.attemptId),
      placements: await ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
          query.eq("tryoutAttemptId", result.attemptId)
        )
        .collect(),
    }));

    expect(runtime.attempt).toMatchObject({
      status: "in-progress",
      tryoutSetId: seeded.fixture.tryoutSetId,
    });
    expect(runtime.attempt).not.toHaveProperty("setIdentity");
    expect(runtime.attempt).not.toHaveProperty("tryoutSnapshotId");
    expect(runtime.placements).toHaveLength(1);
    expect(runtime.placements[0]).not.toHaveProperty("placementIdentity");
    expect(runtime.placements[0]).not.toHaveProperty("sectionIdentity");
  });

  it("resumes a legacy attempt while signed ownership is active", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-signed-legacy-resume",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        userId: identity.userId,
        visibility: "visible",
      });
      const attemptId = await insertTryoutAttempt(ctx, {
        expiresAt: NOW + 86_400_000,
        sectionSnapshots: [],
        tryoutSetId: fixture.tryoutSetId,
        userId: identity.userId,
      });

      return { attemptId, identity };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    await expect(
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
        countryKey: COUNTRY,
        examKey: EXAM,
        locale: "id",
        setKey: SET,
        trackKey: TRACK,
      })
    ).resolves.toEqual({ attemptId: seeded.attemptId });

    const runtime = await t.query(async (ctx) => ({
      attempts: await ctx.db.query("tryoutAttempts").collect(),
      freeClaims: await ctx.db.query("tryoutFreeAttemptClaims").collect(),
    }));

    expect(runtime.attempts).toHaveLength(1);
    expect(runtime.freeClaims).toEqual([]);
  });

  it("starts an internal entry section atomically with a new attempt", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-entry",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        userId: identity.userId,
        visibility: "internal-entry",
      });

      return { fixture, identity };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    const result = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: COUNTRY,
        entrySectionKey: SECTION,
        examKey: EXAM,
        locale: "id",
        setKey: SET,
        trackKey: TRACK,
      }
    );
    const runtime = await t.query(async (ctx) => {
      const attempt = await ctx.db.get(result.attemptId);
      const sectionAttempts = await ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
          q.eq("tryoutAttemptId", result.attemptId)
        )
        .collect();
      const placements = await ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_tryoutAttemptId_and_questionOrder", (q) =>
          q.eq("tryoutAttemptId", result.attemptId)
        )
        .collect();
      const progress = await ctx.db
        .query("tryoutSetProgress")
        .withIndex("by_userId_and_setIdentity", (q) =>
          q
            .eq("userId", seeded.identity.userId)
            .eq("setIdentity", seeded.fixture.setIdentity)
        )
        .unique();
      const freeClaim = await ctx.db
        .query("tryoutFreeAttemptClaims")
        .withIndex("by_userId", (q) => q.eq("userId", seeded.identity.userId))
        .unique();

      return { attempt, freeClaim, placements, progress, sectionAttempts };
    });

    expect(runtime.attempt).toMatchObject({
      accessEndsAt: NOW + 3 * 86_400_000,
      accessSourceKind: "free",
      countsForCompetition: false,
      countryKey: COUNTRY,
      examKey: EXAM,
      locale: "id",
      scoreStatus: "official",
      setIdentity: seeded.fixture.setIdentity,
      setKey: SET,
      status: "in-progress",
      trackKey: TRACK,
      tryoutSnapshotId: seeded.fixture.snapshotId,
    });
    expect(runtime.attempt).not.toHaveProperty("tryoutSetId");
    expect(runtime.attempt?.sectionSnapshots).toEqual([
      expect.objectContaining({
        sectionIdentity: seeded.fixture.sectionIdentity,
        sectionKey: SECTION,
        sectionRowHash: seeded.fixture.sectionRowHash,
      }),
    ]);
    expect(runtime.attempt?.sectionSnapshots[0]).not.toHaveProperty(
      "tryoutSectionId"
    );
    expect(runtime.sectionAttempts).toEqual([
      expect.objectContaining({
        sectionIdentity: seeded.fixture.sectionIdentity,
        sectionKey: SECTION,
        status: "in-progress",
      }),
    ]);
    expect(runtime.sectionAttempts[0]).not.toHaveProperty("tryoutSectionId");
    expect(runtime.placements).toEqual([
      expect.objectContaining({
        placementIdentity: seeded.fixture.placementIdentity,
        placementRowHash: seeded.fixture.placementRowHash,
        sectionIdentity: seeded.fixture.sectionIdentity,
        sectionKey: SECTION,
      }),
    ]);
    expect(runtime.placements[0]).not.toHaveProperty("tryoutSectionId");
    expect(runtime.freeClaim).toMatchObject({
      setKey: SET,
      userId: seeded.identity.userId,
    });
    expect(runtime.progress).toMatchObject({
      latestAttemptId: result.attemptId,
      setIdentity: seeded.fixture.setIdentity,
      status: "in-progress",
      statusRank: 1,
    });
    expect(runtime.progress).not.toHaveProperty("tryoutSetId");

    const current = await authed.query(api.tryouts.queries.attempt.getCurrent, {
      countryKey: COUNTRY,
      examKey: EXAM,
      locale: "id",
      sectionKey: SECTION,
      setKey: SET,
      trackKey: TRACK,
    });

    expect(current).toMatchObject({
      activeSectionKey: SECTION,
      score: null,
    });
    expect(current?.section).toMatchObject({
      score: null,
      sectionKey: SECTION,
      status: "in-progress",
    });

    const sectionRuntime = await authed.query(
      api.tryouts.queries.runtime.getSection,
      {
        countryKey: COUNTRY,
        examKey: EXAM,
        locale: "id",
        sectionKey: SECTION,
        setKey: SET,
        trackKey: TRACK,
      }
    );

    expect(sectionRuntime).toMatchObject({
      questions: expect.any(Array),
      section: { score: null },
    });
    expect(sectionRuntime?.questions).toHaveLength(1);

    const resumed = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: COUNTRY,
        entrySectionKey: SECTION,
        examKey: EXAM,
        locale: "id",
        setKey: SET,
        trackKey: TRACK,
      }
    );

    expect(resumed).toEqual(result);

    await t.mutation((ctx) =>
      ctx.db.patch(result.attemptId, {
        completedAt: NOW + 1,
        endReason: "submitted",
        status: "completed",
      })
    );

    await expect(
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
        countryKey: COUNTRY,
        examKey: EXAM,
        locale: "id",
        setKey: SET,
        trackKey: TRACK,
      })
    ).rejects.toThrow("TRYOUT_ACCESS_REQUIRED");
  });

  it("starts remaining sections from the immutable attempt snapshot", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-snapshot",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        includeEntitlement: true,
        userId: identity.userId,
        visibility: "visible",
      });

      return { fixture, identity };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });
    const attempt = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: COUNTRY,
        examKey: EXAM,
        locale: "id",
        setKey: SET,
        trackKey: TRACK,
      }
    );

    const paidStart = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(attempt.attemptId),
      claims: await ctx.db.query("tryoutFreeAttemptClaims").collect(),
    }));

    expect(paidStart.attempt).toMatchObject({
      accessSourceKind: tryoutEntitlementSourceKindCompetition,
      countsForCompetition: true,
    });
    expect(paidStart.claims).toEqual([]);

    await t.mutation((ctx) =>
      ctx.db.patch(seeded.fixture.tryoutSectionId, {
        sourceRevision: "2027",
        timeLimitSeconds: 60,
      })
    );
    const resumed = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: COUNTRY,
        examKey: EXAM,
        locale: "id",
        setKey: SET,
        trackKey: TRACK,
      }
    );

    expect(resumed).toEqual(attempt);

    await authed.mutation(api.tryouts.mutations.sections.start, {
      attemptId: attempt.attemptId,
      sectionKey: SECTION,
    });

    const sectionAttempt = await t.query((ctx) =>
      ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionKey", (q) =>
          q.eq("tryoutAttemptId", attempt.attemptId).eq("sectionKey", SECTION)
        )
        .unique()
    );

    expect(sectionAttempt).toMatchObject({
      expiresAt: NOW + 1_800_000,
      sectionIdentity: seeded.fixture.sectionIdentity,
      sectionKey: SECTION,
      status: "in-progress",
      totalQuestions: 1,
    });
    expect(sectionAttempt).not.toHaveProperty("tryoutSectionId");
  });
});
