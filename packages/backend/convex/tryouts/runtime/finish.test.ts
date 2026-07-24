import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  expireAttempt,
  finalizeSectionAttempt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import { createAttemptPlacements } from "@repo/backend/convex/tryouts/runtime/placement";
import {
  activateRuntimeSnapshot,
  insertRuntimeSectionSource,
} from "@repo/backend/test/runtime-snapshot";
import {
  insertIrtScaleItem,
  insertTryoutAttempt,
  insertTryoutSectionAttempt,
  tryoutSectionSnapshot,
} from "@repo/backend/test/tryout-runtime";
import {
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
} from "@repo/backend/test/tryouts";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
const EXPIRED_AT = NOW - 1000;
const SET_PATH = "try-out/indonesia/snbt/2027/set-1";
const FIRST_SECTION = "pengetahuan-kuantitatif";
const SECOND_SECTION = "penalaran-matematika";

describe("tryouts/runtime/finish", () => {
  it("expires opened and unopened IRT sections before scoring", async () => {
    const t = convexTest(schema, convexModules);

    const snapshot = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-expire-irt",
        credits: 0,
        creditsResetAt: NOW,
        email: "expire-irt@example.com",
        name: "Expire IRT",
        plan: "pro",
      });
      const firstSource = await insertRuntimeSectionSource(ctx, FIRST_SECTION);
      const secondSource = await insertRuntimeSectionSource(
        ctx,
        SECOND_SECTION
      );
      const tryoutSetId = await insertTryoutSet(ctx, {
        sectionCount: 2,
        totalQuestionCount: 2,
        visibleSectionCount: 2,
      });
      const firstSectionId = await insertTryoutSection(ctx, {
        publicPath: `${SET_PATH}/pengetahuan-kuantitatif`,
        questionSetId: firstSource.questionSetId,
        questionSourcePath: firstSource.sourcePath,
        sectionKey: FIRST_SECTION,
        tryoutSetId,
      });
      const secondSectionId = await insertTryoutSection(ctx, {
        order: 2,
        publicPath: `${SET_PATH}/penalaran-matematika`,
        questionSetId: secondSource.questionSetId,
        questionSourcePath: secondSource.sourcePath,
        sectionKey: SECOND_SECTION,
        tryoutSetId,
      });
      const snapshotId = await activateRuntimeSnapshot(ctx, [
        {
          order: 1,
          publicPath: `${SET_PATH}/${FIRST_SECTION}`,
          sectionKey: FIRST_SECTION,
          sourcePath: firstSource.sourcePath,
        },
        {
          order: 2,
          publicPath: `${SET_PATH}/${SECOND_SECTION}`,
          sectionKey: SECOND_SECTION,
          sourcePath: secondSource.sourcePath,
        },
      ]);
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW,
        questionCount: 2,
        status: "provisional",
        tryoutSetId,
      });

      await insertIrtScaleItem(ctx, {
        questionId: firstSource.questionId,
        scaleVersionId,
        sectionId: firstSectionId,
        sourcePath: firstSource.sourcePath,
      });
      await insertIrtScaleItem(ctx, {
        questionId: secondSource.questionId,
        scaleVersionId,
        sectionId: secondSectionId,
        sourcePath: secondSource.sourcePath,
      });

      const attemptId = await insertTryoutAttempt(ctx, {
        expiresAt: EXPIRED_AT,
        scaleVersionId,
        sectionSnapshots: [
          tryoutSectionSnapshot({
            order: 1,
            publicPath: `${SET_PATH}/pengetahuan-kuantitatif`,
            questionSetId: firstSource.questionSetId,
            sectionKey: FIRST_SECTION,
            sourcePath: firstSource.sourcePath,
            tryoutSectionId: firstSectionId,
          }),
          tryoutSectionSnapshot({
            order: 2,
            publicPath: `${SET_PATH}/penalaran-matematika`,
            questionSetId: secondSource.questionSetId,
            sectionKey: SECOND_SECTION,
            sourcePath: secondSource.sourcePath,
            tryoutSectionId: secondSectionId,
          }),
        ],
        snapshotId,
        tryoutSetId,
        userId,
      });
      const sectionAttemptId = await insertTryoutSectionAttempt(ctx, {
        expiresAt: EXPIRED_AT,
        sectionKey: FIRST_SECTION,
        tryoutAttemptId: attemptId,
        tryoutSectionId: firstSectionId,
      });
      const attempt = await ctx.db.get(attemptId);

      if (!attempt) {
        throw new ConvexError({
          code: "TRYOUT_ATTEMPT_NOT_FOUND",
          message: "Expected try-out attempt fixture.",
        });
      }

      await runConvexProgram(createAttemptPlacements(ctx, { attempt }));

      const placement = await ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex(
          "by_tryoutAttemptId_and_tryoutSectionId_and_questionOrder",
          (q) =>
            q
              .eq("tryoutAttemptId", attemptId)
              .eq("tryoutSectionId", firstSectionId)
        )
        .unique();

      if (!placement) {
        throw new ConvexError({
          code: "TRYOUT_PLACEMENT_NOT_FOUND",
          message: "Expected try-out placement fixture.",
        });
      }

      await ctx.db.insert("tryoutResponses", {
        answeredAt: NOW - 5000,
        isCorrect: true,
        placementId: placement._id,
        questionId: firstSource.questionId,
        selectedOptionId: "option-1",
        timeSpent: 1000,
        tryoutAttemptId: attemptId,
        tryoutSectionAttemptId: sectionAttemptId,
        updatedAt: NOW - 5000,
      });
      await expireAttempt(ctx, { attempt, now: NOW });

      const sections = await ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
          q.eq("tryoutAttemptId", attemptId)
        )
        .collect();
      const score = await ctx.db
        .query("tryoutScores")
        .withIndex("by_tryoutAttemptId", (q) =>
          q.eq("tryoutAttemptId", attemptId)
        )
        .unique();

      return { attempt: await ctx.db.get(attemptId), score, sections };
    });

    expect(snapshot).toMatchObject({
      attempt: {
        completedSectionKeys: [FIRST_SECTION, SECOND_SECTION],
        endReason: "time-expired",
        status: "expired",
      },
      score: {
        rawScore: 50,
        scoringStrategy: "irt",
      },
      sections: [
        {
          endReason: "time-expired",
          score: { rawScore: 100, scoringStrategy: "irt", theta: 4 },
          sectionKey: FIRST_SECTION,
          status: "expired",
        },
        {
          endReason: "time-expired",
          score: { rawScore: 0, scoringStrategy: "irt", theta: -4 },
          sectionKey: SECOND_SECTION,
          status: "expired",
        },
      ],
    });
  });

  it("completes the parent after its final section", async () => {
    const t = convexTest(schema, convexModules);

    const completed = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-section-timeout",
        credits: 0,
        creditsResetAt: NOW,
        email: "section-timeout@example.com",
        name: "Section Timeout",
        plan: "pro",
      });
      const sourcePath =
        "question-bank/tryout/indonesia/snbt/2027/set-1/penalaran-matematika";
      const questionSetId = await insertTryoutQuestionSource(ctx, {
        sourcePath,
        withQuestion: false,
      });
      const tryoutSetId = await insertTryoutSet(ctx);
      const tryoutSectionId = await insertTryoutSection(ctx, {
        publicPath: `${SET_PATH}/penalaran-matematika`,
        questionSetId,
        questionSourcePath: sourcePath,
        tryoutSetId,
      });
      const attemptId = await insertTryoutAttempt(ctx, {
        scoringStrategy: "raw",
        sectionSnapshots: [
          tryoutSectionSnapshot({
            order: 1,
            publicPath: `${SET_PATH}/penalaran-matematika`,
            questionSetId,
            sectionKey: "penalaran-matematika",
            sourcePath,
            tryoutSectionId,
          }),
        ],
        tryoutSetId,
        userId,
      });
      const sectionId = await insertTryoutSectionAttempt(ctx, {
        expiresAt: NOW,
        tryoutAttemptId: attemptId,
        tryoutSectionId,
      });
      const attempt = await ctx.db.get(attemptId);
      const section = await ctx.db.get(sectionId);

      if (!(attempt && section)) {
        throw new ConvexError({
          code: "TRYOUT_FIXTURE_INCOMPLETE",
          message: "Expected try-out attempt and section fixtures.",
        });
      }

      await finalizeSectionAttempt(ctx, {
        attempt,
        endReason: "time-expired",
        now: NOW,
        section,
      });

      return {
        attempt: await ctx.db.get(attemptId),
        section: await ctx.db.get(sectionId),
      };
    });

    expect(completed).toMatchObject({
      attempt: {
        completedSectionKeys: ["penalaran-matematika"],
        endReason: "submitted",
        status: "completed",
      },
      section: {
        endReason: "time-expired",
        score: {
          publishedScore: 0,
          scoreStatus: "official",
          scoringStrategy: "raw",
        },
        status: "expired",
      },
    });
  });
});
