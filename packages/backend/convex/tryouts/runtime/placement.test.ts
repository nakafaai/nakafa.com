import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createAttemptPlacements } from "@repo/backend/convex/tryouts/runtime/placement";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 8, 12, 0, 0);
const TRACK = "2027";
const SECTION = "penalaran-matematika";
const SOURCE = `question-bank/tryout/indonesia/snbt/${TRACK}/set-1/${SECTION}`;
const SET_ROUTE = `try-out/indonesia/snbt/${TRACK}/set-1`;
const ROUTE = `${SET_ROUTE}/${SECTION}`;

async function insertSource(ctx: MutationCtx) {
  const questionSetId = await ctx.db.insert("questionSets", {
    contentHash: "question-set-hash",
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    questionCount: 1,
    sectionKey: SECTION,
    setKey: "set-1",
    sourcePath: SOURCE,
    sourceRevision: "2026",
    syncedAt: NOW,
    title: "Penalaran Matematika",
  });
  const questionId = await ctx.db.insert("questions", {
    answerBody: "Answer",
    contentHash: "new-question-hash",
    date: 0,
    locale: "id",
    number: 1,
    questionBody: "Question",
    questionSetId,
    sourceKey: `${SOURCE}:question-1`,
    sourcePath: `${SOURCE}/question-1`,
    sourceRevision: "2027",
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

  return questionSetId;
}

async function insertRuntime(
  ctx: MutationCtx,
  questionSetId: Id<"questionSets">
) {
  const userId = await ctx.db.insert("users", {
    authId: "auth-placement",
    credits: 0,
    creditsResetAt: NOW,
    email: "placement@example.com",
    name: "Placement",
    plan: "pro",
  });
  const tryoutSetId = await ctx.db.insert("tryoutSets", {
    countryKey: "indonesia",
    examKey: "snbt",
    isActive: true,
    isReady: true,
    locale: "id",
    order: 1,
    publicPath: SET_ROUTE,
    readyQuestionCount: 1,
    readyVisibleSectionCount: 1,
    scoringStrategy: "irt",
    sectionCount: 1,
    setKey: "set-1",
    sourceRevision: "2026",
    syncedAt: NOW,
    title: "Set 1",
    trackKey: TRACK,
    totalQuestionCount: 1,
    visibleSectionCount: 1,
  });
  const sectionId = await ctx.db.insert("tryoutSections", {
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    order: 1,
    publicPath: ROUTE,
    questionCount: 1,
    questionSetId,
    questionSourcePath: SOURCE,
    sectionKey: SECTION,
    setKey: "set-1",
    sourceRevision: "2026",
    syncedAt: NOW,
    timeLimitSeconds: 1800,
    title: "Penalaran Matematika",
    trackKey: TRACK,
    tryoutSetId,
    visibility: "visible",
  });
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    attemptNumber: 1,
    completedAt: null,
    completedSectionKeys: [],
    endReason: null,
    expiresAt: NOW + 86_400_000,
    lastActivityAt: NOW,
    scoreStatus: "provisional",
    scoringStrategy: "irt",
    sectionSnapshots: [
      {
        publicPath: ROUTE,
        questionCount: 1,
        questionSetId,
        questionSourcePath: SOURCE,
        sectionKey: SECTION,
        sectionOrder: 1,
        sourceRevision: "2026",
        tryoutSectionId: sectionId,
      },
    ],
    startedAt: NOW,
    status: "in-progress",
    totalCorrect: 0,
    totalQuestions: 1,
    tryoutSetId,
    userId,
  });
  const attempt = await ctx.db.get(attemptId);

  if (!attempt) {
    throw new ConvexError({
      code: "TRYOUT_FIXTURE_NOT_FOUND",
      message: "Expected try-out fixture rows.",
    });
  }

  return attempt;
}

describe("tryouts/runtime/placement", () => {
  it("rejects question rows from a different source revision", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const questionSetId = await insertSource(ctx);
        const attempt = await insertRuntime(ctx, questionSetId);

        await createAttemptPlacements(ctx, { attempt });
      })
    ).rejects.toThrow("TRYOUT_QUESTION_SNAPSHOT_MISMATCH");
  });
});
