import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { tryoutEntitlementSourceKindCompetition } from "@repo/backend/convex/tryoutAccess/schema";
import {
  TRYOUT_START_COUNTRY as COUNTRY,
  TRYOUT_START_EXAM as EXAM,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_SECTION as SECTION,
  TRYOUT_START_SET as SET,
  seedTryoutStartSet,
  TRYOUT_START_TRACK as TRACK,
} from "@repo/backend/test/tryout-start";
import { describe, expect, it, vi } from "vitest";

describe("tryouts/mutations/attempts", () => {
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
        .withIndex("by_userId_and_tryoutSetId", (q) =>
          q
            .eq("userId", seeded.identity.userId)
            .eq("tryoutSetId", seeded.fixture.tryoutSetId)
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
      scoreStatus: "official",
      status: "in-progress",
      tryoutSetId: seeded.fixture.tryoutSetId,
    });
    expect(runtime.sectionAttempts).toEqual([
      expect.objectContaining({
        sectionKey: SECTION,
        status: "in-progress",
        tryoutSectionId: seeded.fixture.tryoutSectionId,
      }),
    ]);
    expect(runtime.placements).toHaveLength(1);
    expect(runtime.freeClaim).toMatchObject({
      setKey: SET,
      userId: seeded.identity.userId,
    });
    expect(runtime.progress).toMatchObject({
      latestAttemptId: result.attemptId,
      status: "in-progress",
      statusRank: 1,
    });

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

  it("rejects entry-section starts for visible sections", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-visible",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "visible",
      });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
        countryKey: COUNTRY,
        entrySectionKey: SECTION,
        examKey: EXAM,
        locale: "id",
        setKey: SET,
        trackKey: TRACK,
      })
    ).rejects.toThrow("TRYOUT_ENTRY_SECTION_NOT_FOUND");

    const claims = await t.query((ctx) =>
      ctx.db.query("tryoutFreeAttemptClaims").collect()
    );

    expect(claims).toEqual([]);
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
      sectionKey: SECTION,
      status: "in-progress",
      totalQuestions: 1,
      tryoutSectionId: seeded.fixture.tryoutSectionId,
    });
  });
});
