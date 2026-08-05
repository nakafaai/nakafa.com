import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { tryoutEntitlementSourceKindCompetition } from "@repo/backend/convex/tryoutAccess/schema";
import { testTextHash } from "@repo/backend/test/content-release";
import { insertTryoutAttempt } from "@repo/backend/test/tryout-runtime";
import {
  activateRenamedTryoutStartSource,
  activateReusedTryoutStartPath,
  TRYOUT_START_COUNTRY as COUNTRY,
  TRYOUT_START_EXAM as EXAM,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_SECTION as SECTION,
  TRYOUT_START_SET as SET,
  TRYOUT_START_TRACK as TRACK,
  TRYOUT_RENAMED_SET_PATH,
} from "@repo/backend/test/tryout-source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout-start";
import type { FunctionArgs } from "convex/server";
import { describe, expect, it, vi } from "vitest";

const startArgs: FunctionArgs<
  typeof api.tryouts.mutations.attempts.startAttempt
> = {
  countryKey: COUNTRY,
  examKey: EXAM,
  locale: "id",
  setKey: SET,
  trackKey: TRACK,
};

const entryStartArgs: FunctionArgs<
  typeof api.tryouts.mutations.attempts.startAttempt
> = {
  ...startArgs,
  entrySectionKey: SECTION,
};
describe("tryouts/mutations/attempts", () => {
  it("resumes from the frozen attempt when the current entry key changed", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-changed-entry-resume",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        userId: identity.userId,
        visibility: "internal-entry",
      });
      const attemptId = await insertTryoutAttempt(ctx, {
        expiresAt: NOW + 86_400_000,
        sectionSnapshots: [
          {
            publicPath: undefined,
            questionCount: 1,
            questionSourcePath: "question-bank/tryout/frozen-entry",
            sectionIdentity: "tryout:section:frozen-entry",
            sectionKey: "frozen-entry",
            sectionOrder: 1,
            sectionRowHash: testTextHash("frozen-entry"),
            sourceRevision: "2025",
            timeLimitSeconds: 1800,
          },
        ],
        set: fixture.set,
        userId: identity.userId,
      });
      return { attemptId, identity };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });
    await expect(
      authed.mutation(
        api.tryouts.mutations.attempts.startAttempt,
        entryStartArgs
      )
    ).resolves.toMatchObject({ attemptId: seeded.attemptId });
    const sectionAttempts = await t.query((ctx) =>
      ctx.db.query("tryoutSectionAttempts").collect()
    );
    expect(sectionAttempts).toMatchObject([
      {
        sectionKey: "frozen-entry",
        status: "in-progress",
        tryoutAttemptId: seeded.attemptId,
      },
    ]);
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
      entryStartArgs
    );
    expect(result.navigation.publicPath).toBe(
      `try-out/${COUNTRY}/${EXAM}/${TRACK}/${SET}`
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
    expect(runtime.attempt?.sectionSnapshots).toEqual([
      expect.objectContaining({
        sectionIdentity: seeded.fixture.sectionIdentity,
        sectionKey: SECTION,
        sectionRowHash: seeded.fixture.sectionRowHash,
      }),
    ]);
    expect(runtime.sectionAttempts).toEqual([
      expect.objectContaining({
        sectionIdentity: seeded.fixture.sectionIdentity,
        sectionKey: SECTION,
        status: "in-progress",
      }),
    ]);
    expect(runtime.placements).toEqual([
      expect.objectContaining({
        placementIdentity: seeded.fixture.placementIdentity,
        placementRowHash: seeded.fixture.placementRowHash,
        sectionIdentity: seeded.fixture.sectionIdentity,
        sectionKey: SECTION,
      }),
    ]);
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
      entryStartArgs
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
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, startArgs)
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
    await t.mutation(activateRenamedTryoutStartSource);
    const attempt = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      { ...startArgs, destinationSectionKey: SECTION }
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
    expect(attempt.navigation).toEqual({
      publicPath: `${TRYOUT_RENAMED_SET_PATH}/${SECTION}`,
    });

    await t.mutation(activateReusedTryoutStartPath);
    const resumed = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      { ...startArgs, destinationSectionKey: SECTION }
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
  });
});
