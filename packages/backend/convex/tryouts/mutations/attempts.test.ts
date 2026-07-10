import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { tryoutEntitlementSourceKindCompetition } from "@repo/backend/convex/tryoutAccess/schema";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 8, 12, 0, 0);
const COUNTRY = "indonesia";
const EXAM = "tka";
const TRACK = "matematika";
const SET = "set-1";
const SECTION = "matematika";
const SOURCE = `question-bank/tryout/${COUNTRY}/${EXAM}/${TRACK}/${SET}/${SECTION}`;
const SET_ROUTE = `try-out/${COUNTRY}/${EXAM}/${TRACK}/${SET}`;

type SectionVisibility = "internal-entry" | "visible";

/** Seeds the smallest try-out set needed by attempt start mutations. */
async function seedTryoutSet(
  ctx: MutationCtx,
  args: {
    isReady?: boolean;
    trackIsReady?: boolean;
    userId: Id<"users">;
    visibility: SectionVisibility;
  }
) {
  await ctx.db.insert("tryoutCountries", {
    countryKey: COUNTRY,
    isActive: true,
    locale: "id",
    order: 1,
    publicPath: `try-out/${COUNTRY}`,
    sourceRevision: "2026",
    syncedAt: NOW,
    title: "Indonesia",
  });
  await ctx.db.insert("tryoutExams", {
    countryKey: COUNTRY,
    examKey: EXAM,
    isActive: true,
    locale: "id",
    order: 1,
    publicPath: `try-out/${COUNTRY}/${EXAM}`,
    scoringStrategy: "raw",
    sourceRevision: "2026",
    syncedAt: NOW,
    title: "TKA",
  });
  await ctx.db.insert("tryoutTracks", {
    authoredSetCount: 1,
    countryKey: COUNTRY,
    examKey: EXAM,
    isActive: true,
    isReady: args.trackIsReady ?? true,
    locale: "id",
    order: 1,
    publicPath: `try-out/${COUNTRY}/${EXAM}/${TRACK}`,
    readyQuestionCount: 1,
    readySetCount: args.trackIsReady === false ? 0 : 1,
    readyVisibleSectionCount:
      args.trackIsReady === false || args.visibility !== "visible" ? 0 : 1,
    sourceRevision: "2026",
    syncedAt: NOW,
    title: "Matematika",
    trackKey: TRACK,
    trackKind: "subject",
  });

  const questionSetId = await ctx.db.insert("questionSets", {
    contentHash: "question-set-hash",
    countryKey: COUNTRY,
    examKey: EXAM,
    locale: "id",
    questionCount: 1,
    sectionKey: SECTION,
    setKey: SET,
    sourcePath: SOURCE,
    sourceRevision: "2026",
    syncedAt: NOW,
    title: "Matematika",
  });
  const questionId = await ctx.db.insert("questions", {
    answerBody: "Answer",
    contentHash: "question-hash",
    date: 0,
    locale: "id",
    number: 1,
    questionBody: "Question",
    questionSetId,
    sourceKey: `${SOURCE}:question-1`,
    sourcePath: `${SOURCE}/question-1`,
    sourceRevision: "2026",
    syncedAt: NOW,
    title: "Question",
  });

  await ctx.db.insert("questionChoices", {
    isCorrect: true,
    label: "A",
    locale: "id",
    optionKey: "a",
    order: 1,
    questionId,
  });

  const tryoutSetId = await ctx.db.insert("tryoutSets", {
    countryKey: COUNTRY,
    examKey: EXAM,
    internalEntrySectionKey:
      args.visibility === "internal-entry" ? SECTION : undefined,
    isActive: true,
    isReady: args.isReady ?? true,
    locale: "id",
    order: 1,
    publicPath: SET_ROUTE,
    readyQuestionCount: 1,
    readyVisibleSectionCount: args.visibility === "visible" ? 1 : 0,
    scoringStrategy: "raw",
    sectionCount: 1,
    setKey: SET,
    sourceRevision: "2026",
    syncedAt: NOW,
    title: "Set 1",
    totalQuestionCount: 1,
    trackKey: TRACK,
    visibleSectionCount: args.visibility === "visible" ? 1 : 0,
  });
  const tryoutSectionId = await ctx.db.insert("tryoutSections", {
    countryKey: COUNTRY,
    examKey: EXAM,
    locale: "id",
    order: 1,
    publicPath:
      args.visibility === "visible" ? `${SET_ROUTE}/${SECTION}` : undefined,
    questionCount: 1,
    questionSetId,
    questionSourcePath: SOURCE,
    sectionKey: SECTION,
    setKey: SET,
    sourceRevision: "2026",
    syncedAt: NOW,
    timeLimitSeconds: 1800,
    title: "Matematika",
    trackKey: TRACK,
    tryoutSetId,
    visibility: args.visibility,
  });

  await ctx.db.insert("tryoutEntitlements", {
    countryKey: COUNTRY,
    endsAt: NOW + 86_400_000,
    examKey: EXAM,
    setKey: SET,
    sourceKind: tryoutEntitlementSourceKindCompetition,
    startsAt: NOW,
    trackKey: TRACK,
    userId: args.userId,
  });

  return { tryoutSectionId, tryoutSetId };
}

describe("tryouts/mutations/attempts", () => {
  it("starts an internal entry section atomically with a new attempt", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-entry",
      });
      const fixture = await seedTryoutSet(ctx, {
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

      return { attempt, placements, sectionAttempts };
    });

    expect(runtime.attempt).toMatchObject({
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

    const current = await authed.query(api.tryouts.queries.attempt.getCurrent, {
      countryKey: COUNTRY,
      examKey: EXAM,
      locale: "id",
      sectionKey: SECTION,
      setKey: SET,
      trackKey: TRACK,
    });

    expect(current?.section).toMatchObject({
      sectionKey: SECTION,
      status: "in-progress",
    });

    const sectionRuntime = await authed.query(
      api.tryouts.queries.attempt.getSectionRuntime,
      {
        countryKey: COUNTRY,
        examKey: EXAM,
        locale: "id",
        sectionKey: SECTION,
        setKey: SET,
        trackKey: TRACK,
      }
    );

    expect(sectionRuntime?.questions).toHaveLength(1);
  });

  it("rejects entry-section starts for visible sections", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-visible",
      });
      await seedTryoutSet(ctx, {
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
  });

  it("rejects attempts for active sets that are not ready", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-unready",
      });
      await seedTryoutSet(ctx, {
        isReady: false,
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
        examKey: EXAM,
        locale: "id",
        setKey: SET,
        trackKey: TRACK,
      })
    ).rejects.toThrow("TRYOUT_SET_NOT_READY");

    const attemptCount = await t.query(async (ctx) => {
      const attempts = await ctx.db.query("tryoutAttempts").collect();
      return attempts.length;
    });

    expect(attemptCount).toBe(0);
  });

  it("rejects attempts when the parent track is not ready", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-track-unready",
      });
      await seedTryoutSet(ctx, {
        trackIsReady: false,
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
        examKey: EXAM,
        locale: "id",
        setKey: SET,
        trackKey: TRACK,
      })
    ).rejects.toThrow("TRYOUT_SET_NOT_READY");

    const attemptCount = await t.query(async (ctx) => {
      const attempts = await ctx.db.query("tryoutAttempts").collect();
      return attempts.length;
    });

    expect(attemptCount).toBe(0);
  });
});
