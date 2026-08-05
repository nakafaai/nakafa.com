import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  expireAttempt,
  finalizeSectionAttempt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import { createAttemptPlacements } from "@repo/backend/convex/tryouts/runtime/placement";
import {
  insertIrtScaleItem,
  insertTryoutAttempt,
  insertTryoutSectionAttempt,
  insertTryoutUser,
  tryoutSectionSnapshot,
} from "@repo/backend/test/tryout-runtime";
import {
  makeSignedTryoutSection,
  makeSignedTryoutSource,
} from "@repo/backend/test/tryout-section";
import { makeTryoutSection, makeTryoutSet } from "@repo/backend/test/tryouts";
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
      const userId = await insertTryoutUser(ctx, {
        authId: "auth-expire-irt",
        email: "expire-irt@example.com",
        name: "Expire IRT",
      });
      const set = makeTryoutSet({
        questionCount: 2,
        sectionCount: 2,
        visibleSectionCount: 2,
      });
      const firstSection = makeTryoutSection({
        publicPath: `${SET_PATH}/pengetahuan-kuantitatif`,
        questionSourcePath: `packages/corpus/question-bank/tryout/indonesia/snbt/${FIRST_SECTION}/set-1`,
        sectionKey: FIRST_SECTION,
      });
      const secondSection = makeTryoutSection({
        order: 2,
        publicPath: `${SET_PATH}/penalaran-matematika`,
        questionSourcePath: `packages/corpus/question-bank/tryout/indonesia/snbt/${SECOND_SECTION}/set-1`,
        sectionKey: SECOND_SECTION,
      });
      const alignedSections = [
        makeSignedTryoutSection(firstSection),
        makeSignedTryoutSection(secondSection),
      ];
      const firstPlacement = alignedSections[0]?.signed.placements[0];
      const secondPlacement = alignedSections[1]?.signed.placements[0];
      if (!(firstPlacement && secondPlacement)) {
        throw new ConvexError({
          code: "TRYOUT_PLACEMENT_NOT_FOUND",
          message: "Expected signed try-out placement fixtures.",
        });
      }
      const source = makeSignedTryoutSource(set, alignedSections);
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW,
        questionCount: 2,
        setIdentity: source.snapshot.setIdentity,
        status: "provisional",
        tryoutSnapshotId: source.snapshot.snapshotId,
      });
      await insertIrtScaleItem(ctx, {
        placement: firstPlacement,
        scaleVersionId,
      });
      await insertIrtScaleItem(ctx, {
        placement: secondPlacement,
        scaleVersionId,
      });

      const attemptId = await insertTryoutAttempt(ctx, {
        expiresAt: EXPIRED_AT,
        scaleVersionId,
        sectionSnapshots: [
          tryoutSectionSnapshot({
            signed: alignedSections[0]?.signed,
          }),
          tryoutSectionSnapshot({
            signed: alignedSections[1]?.signed,
          }),
        ],
        set,
        snapshotId: source.snapshot.snapshotId,
        snapshotReleaseId: source.bundle.releaseId,
        userId,
      });
      const sectionAttemptId = await insertTryoutSectionAttempt(ctx, {
        expiresAt: EXPIRED_AT,
        sectionKey: FIRST_SECTION,
        tryoutAttemptId: attemptId,
      });
      const attempt = await ctx.db.get(attemptId);
      if (!attempt) {
        throw new ConvexError({
          code: "TRYOUT_ATTEMPT_NOT_FOUND",
          message: "Expected try-out attempt fixture.",
        });
      }

      await runConvexProgram(
        createAttemptPlacements(ctx, {
          attempt,
          source,
        })
      );
      const placement = await ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_tryoutAttemptId_and_sectionKey_and_questionOrder", (q) =>
          q.eq("tryoutAttemptId", attemptId).eq("sectionKey", FIRST_SECTION)
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
        selectedOptionId: "option-1",
        timeSpent: 1000,
        tryoutAttemptId: attemptId,
        tryoutSectionAttemptId: sectionAttemptId,
        updatedAt: NOW - 5000,
      });
      await runConvexProgram(expireAttempt(ctx, { attempt, now: NOW }));

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
      const userId = await insertTryoutUser(ctx, {
        authId: "auth-section-timeout",
        email: "section-timeout@example.com",
        name: "Section Timeout",
      });
      const sourcePath =
        "question-bank/tryout/indonesia/snbt/penalaran-matematika/set-1";
      const set = makeTryoutSet();
      const section = makeTryoutSection({
        publicPath: `${SET_PATH}/penalaran-matematika`,
        questionSourcePath: `packages/corpus/${sourcePath}`,
      });
      const signedSection = makeSignedTryoutSection(section).signed;
      const attemptId = await insertTryoutAttempt(ctx, {
        scoringStrategy: "raw",
        sectionSnapshots: [tryoutSectionSnapshot({ signed: signedSection })],
        set,
        userId,
      });
      const sectionId = await insertTryoutSectionAttempt(ctx, {
        expiresAt: NOW,
        tryoutAttemptId: attemptId,
      });
      const attempt = await ctx.db.get(attemptId);
      const sectionAttempt = await ctx.db.get(sectionId);

      if (!(attempt && sectionAttempt)) {
        throw new ConvexError({
          code: "TRYOUT_FIXTURE_INCOMPLETE",
          message: "Expected try-out attempt and section fixtures.",
        });
      }

      await runConvexProgram(
        finalizeSectionAttempt(ctx, {
          attempt,
          endReason: "time-expired",
          now: NOW,
          section: sectionAttempt,
        })
      );

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
