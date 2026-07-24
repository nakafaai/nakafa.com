import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { tryoutIdentityPlacement } from "@repo/backend/test/tryout-identity";
import {
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  TRYOUT_SECTION_KEY,
  TRYOUT_SECTION_PATH,
  TRYOUT_SOURCE,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";

/** Seeds one coherent legacy attempt graph before stable identity migration. */
export async function seedLegacyTryoutIdentity(
  ctx: MutationCtx,
  input: {
    readonly suffix?: string;
    readonly userId?: Id<"users">;
  } = {}
) {
  let userId = input.userId;
  if (userId === undefined) {
    const user = await seedAuthenticatedUser(ctx, {
      now: TRYOUT_TEST_NOW,
      suffix: input.suffix ?? "identity",
    });
    userId = user.userId;
  }
  const tryoutSetId = await insertTryoutSet(ctx);
  const questionSetId = await insertTryoutQuestionSource(ctx);
  const tryoutSectionId = await insertTryoutSection(ctx, {
    publicPath: TRYOUT_SECTION_PATH,
    questionSetId,
    tryoutSetId,
  });
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    accessEndsAt: TRYOUT_TEST_NOW + 1000,
    accessSourceKind: "free",
    attemptNumber: 1,
    completedAt: null,
    completedSectionKeys: [],
    countsForCompetition: false,
    endReason: null,
    expiresAt: TRYOUT_TEST_NOW + 1000,
    lastActivityAt: TRYOUT_TEST_NOW,
    scoreStatus: "provisional",
    scoringStrategy: "irt",
    sectionSnapshots: [
      {
        publicPath: TRYOUT_SECTION_PATH,
        questionCount: 1,
        questionSetId,
        questionSourcePath: TRYOUT_SOURCE,
        sectionKey: TRYOUT_SECTION_KEY,
        sectionOrder: 1,
        sourceRevision: "2026",
        timeLimitSeconds: 1800,
        tryoutSectionId,
      },
    ],
    startedAt: TRYOUT_TEST_NOW,
    status: "in-progress",
    totalCorrect: 0,
    totalQuestions: 1,
    tryoutSetId,
    userId,
  });
  await ctx.db.insert("tryoutSetProgress", {
    attemptNumber: 1,
    countryKey: "indonesia",
    examKey: "snbt",
    latestAttemptId: attemptId,
    locale: "id",
    publishedScore: null,
    setKey: "set-1",
    status: "in-progress",
    statusRank: 1,
    trackKey: "2027",
    tryoutSetId,
    updatedAt: TRYOUT_TEST_NOW,
    userId,
  });
  const question = await ctx.db
    .query("questions")
    .withIndex("by_questionSetId_and_number", (query) =>
      query.eq("questionSetId", questionSetId).eq("number", 1)
    )
    .unique();
  if (!question) {
    throw new Error("Expected one technical question.");
  }
  const placementId = await ctx.db.insert("tryoutAttemptPlacements", {
    choiceSnapshots: tryoutIdentityPlacement.choices.map((choice) => ({
      ...choice,
    })),
    contentHash: question.contentHash,
    questionId: question._id,
    questionOrder: 1,
    questionSourceKey: question.sourceKey,
    sourcePath: question.sourcePath,
    sourceRevision: question.sourceRevision,
    title: tryoutIdentityPlacement.title,
    tryoutAttemptId: attemptId,
    tryoutSectionId,
  });
  return { attemptId, placementId, tryoutSetId, userId };
}
