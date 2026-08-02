import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import {
  TryoutContentHashSchema,
  type TryoutPlacement,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createAttemptPlacements } from "@repo/backend/convex/tryouts/runtime/placement";
import type { TryoutSectionSource } from "@repo/backend/convex/tryouts/start/source";
import {
  makeAlignedTryoutSection,
  TRYOUT_TEST_CONTENT_HASH,
} from "@repo/backend/test/tryout-section";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 8, 12, 0, 0);
const TRACK = "2027";
const SECTION = "penalaran-matematika";
const SOURCE = `question-bank/tryout/indonesia/snbt/${SECTION}/set-1`;
const SET_ROUTE = `try-out/indonesia/snbt/${TRACK}/set-1`;
const ROUTE = `${SET_ROUTE}/${SECTION}`;

/** Insert the source graph required by placement scenarios. */
async function insertSource(
  ctx: MutationCtx,
  input: {
    readonly contentHash: TryoutPlacement["contentHash"];
    readonly sourceRevision: TryoutPlacement["sourceRevision"];
  } = {
    contentHash: TRYOUT_TEST_CONTENT_HASH,
    sourceRevision: "2027",
  }
) {
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
    contentHash: input.contentHash,
    date: 0,
    locale: "id",
    number: 1,
    questionBody: "Question",
    questionSetId,
    sourceKey: `${SOURCE}:question-1`,
    sourcePath: `${SOURCE}/question-1`,
    sourceRevision: input.sourceRevision,
    syncedAt: NOW,
    title: "Question",
  });

  await ctx.db.insert("questionChoices", {
    isCorrect: true,
    label: "A",
    locale: "id",
    optionKey: "option-1",
    order: 1,
    questionId,
  });

  return questionSetId;
}

/** Insert an attempt runtime required by placement scenarios. */
async function insertRuntime(
  ctx: MutationCtx,
  questionSetId: Id<"questionSets">,
  signedRevision = "2027"
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
  const section = await ctx.db.get(sectionId);
  if (!section) {
    throw new ConvexError({
      code: "TRYOUT_FIXTURE_NOT_FOUND",
      message: "Expected try-out section fixture.",
    });
  }
  const aligned = makeAlignedTryoutSection(section, {
    sourceRevision: signedRevision,
  });
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    accessEndsAt: NOW + 86_400_000,
    accessSourceKind: "free",
    attemptNumber: 1,
    completedAt: null,
    completedSectionKeys: [],
    countsForCompetition: false,
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
        sectionIdentity: tryoutCatalogIdentity(aligned.signed.section.row),
        sectionKey: SECTION,
        sectionOrder: 1,
        sectionRowHash: aligned.signed.section.rowHash,
        sourceRevision: "2026",
        timeLimitSeconds: 1800,
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

  const source: TryoutSectionSource = {
    kind: "signed",
    sections: [aligned],
  };
  return { attempt, source };
}

describe("tryouts/runtime/placement", () => {
  it("freezes signed state independently of legacy question rows", async () => {
    const t = convexTest(schema, convexModules);

    const placement = await t.mutation(async (ctx) => {
      const questionSetId = await insertSource(ctx, {
        contentHash: TryoutContentHashSchema.make("4".repeat(64)),
        sourceRevision: "2026",
      });
      const runtime = await insertRuntime(ctx, questionSetId);

      await runConvexProgram(createAttemptPlacements(ctx, runtime));
      return await ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex(
          "by_tryoutAttemptId_and_tryoutSectionId_and_questionOrder",
          (query) => query.eq("tryoutAttemptId", runtime.attempt._id)
        )
        .unique();
    });

    expect(placement).toMatchObject({
      contentHash: TRYOUT_TEST_CONTENT_HASH,
      sourceRevision: "2027",
    });
    expect(placement).not.toHaveProperty("questionId");
  });

  it("rejects an incomplete signed placement snapshot", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const questionSetId = await insertSource(ctx);
        const runtime = await insertRuntime(ctx, questionSetId);
        const section = runtime.source.sections[0];
        if (!section) {
          throw new Error("Expected one signed section fixture.");
        }

        await runConvexProgram(
          createAttemptPlacements(ctx, {
            attempt: runtime.attempt,
            source: {
              kind: "signed",
              sections: [
                {
                  ...section,
                  signed: { ...section.signed, placements: [] },
                },
              ],
            },
          })
        );
      })
    ).rejects.toThrow("TRYOUT_SECTION_SNAPSHOT_MISMATCH");
  });
});
