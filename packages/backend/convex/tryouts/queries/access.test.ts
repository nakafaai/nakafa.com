import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { TryoutStatus } from "@repo/backend/convex/tryouts/schema";
import {
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { describe, expect, it } from "vitest";

const contentArgs = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id" as const,
  sectionKey: TRYOUT_SECTION_KEY,
  setKey: "set-1",
  trackKey: "2027",
};

/** Returns the coherent terminal reason for one fixture status. */
function getEndReason(status: TryoutStatus) {
  if (status === "in-progress") {
    return null;
  }

  if (status === "expired") {
    return "time-expired" as const;
  }

  return "submitted" as const;
}

/** Inserts one attempt and section state used by the content access query. */
async function seedContentState(
  ctx: MutationCtx,
  args: {
    attemptStatus: TryoutStatus;
    sectionStatus: TryoutStatus;
    suffix: string;
  }
) {
  const identity = await seedAuthenticatedUser(ctx, {
    now: TRYOUT_TEST_NOW,
    suffix: args.suffix,
  });
  const tryoutSetId = await insertTryoutSet(ctx);
  const questionSetId = await insertTryoutQuestionSource(ctx);
  const tryoutSectionId = await insertTryoutSection(ctx, {
    questionSetId,
    tryoutSetId,
  });
  const attemptTerminal = args.attemptStatus !== "in-progress";
  const sectionTerminal = args.sectionStatus !== "in-progress";
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    attemptNumber: 1,
    completedAt: attemptTerminal ? TRYOUT_TEST_NOW : null,
    completedSectionKeys: sectionTerminal ? [TRYOUT_SECTION_KEY] : [],
    endReason: getEndReason(args.attemptStatus),
    expiresAt: TRYOUT_TEST_NOW + 3_600_000,
    lastActivityAt: TRYOUT_TEST_NOW,
    scoreStatus: "official",
    scoringStrategy: "irt",
    sectionSnapshots: [],
    startedAt: TRYOUT_TEST_NOW,
    status: args.attemptStatus,
    totalCorrect: 0,
    totalQuestions: 1,
    tryoutSetId,
    userId: identity.userId,
  });

  const sectionAttemptId = await ctx.db.insert("tryoutSectionAttempts", {
    answeredCount: 0,
    completedAt: sectionTerminal ? TRYOUT_TEST_NOW : null,
    correctAnswers: 0,
    endReason: getEndReason(args.sectionStatus),
    expiresAt: TRYOUT_TEST_NOW + 1_800_000,
    lastActivityAt: TRYOUT_TEST_NOW,
    sectionKey: TRYOUT_SECTION_KEY,
    sectionOrder: 1,
    startedAt: TRYOUT_TEST_NOW,
    status: args.sectionStatus,
    totalQuestions: 1,
    tryoutAttemptId: attemptId,
    tryoutSectionId,
  });

  return { identity, sectionAttemptId };
}

describe("tryouts/queries/access", () => {
  it("rejects anonymous content access", async () => {
    const t = createConvexTestWithBetterAuth();

    expect(
      await t.query(api.tryouts.queries.access.getSectionContent, contentArgs)
    ).toEqual({ answers: false, questions: false });
  });

  it("rejects access when the active set does not exist", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "content-missing-set",
      })
    );
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getSectionContent,
        contentArgs
      )
    ).toEqual({ answers: false, questions: false });
  });

  it("rejects access when the user has no attempt", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "content-missing-attempt",
      });
      await insertTryoutSet(ctx);

      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getSectionContent,
        contentArgs
      )
    ).toEqual({ answers: false, questions: false });
  });

  it("rejects access when the terminal attempt has no section", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedContentState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "content-missing-section",
      });
      await ctx.db.delete(fixture.sectionAttemptId);

      return fixture;
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getSectionContent,
        contentArgs
      )
    ).toEqual({ answers: false, questions: false });
  });

  it.each([
    ["in-progress", "in-progress", { answers: false, questions: true }],
    ["in-progress", "completed", { answers: false, questions: false }],
    ["completed", "in-progress", { answers: false, questions: false }],
    ["completed", "completed", { answers: true, questions: true }],
    ["expired", "expired", { answers: true, questions: true }],
  ] as const)("authorizes attempt=%s section=%s", async (attemptStatus, sectionStatus, expected) => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedContentState(ctx, {
        attemptStatus,
        sectionStatus,
        suffix: `content-${attemptStatus}-${sectionStatus}`,
      })
    );
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getSectionContent,
        contentArgs
      )
    ).toEqual(expected);
  });
});
