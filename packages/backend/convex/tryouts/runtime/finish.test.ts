import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
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
  seedTryoutContentAccessState,
  tryoutSectionSnapshot,
} from "@repo/backend/test/tryout-runtime";
import {
  makeSignedTryoutSection,
  makeSignedTryoutSource,
} from "@repo/backend/test/tryout-section";
import { makeTryoutSection, makeTryoutSet } from "@repo/backend/test/tryouts";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

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
      const query = vi.spyOn(ctx.db, "query");
      await runConvexProgram(expireAttempt(ctx, { attempt, now: NOW }));
      const placementQueryCount = query.mock.calls.filter(
        ([tableName]) => tableName === "tryoutAttemptPlacements"
      ).length;
      const scaleItemQueryCount = query.mock.calls.filter(
        ([tableName]) => tableName === "irtScaleItems"
      ).length;
      const calibrationRunQueryCount = query.mock.calls.filter(
        ([tableName]) => tableName === "irtCalibrationRuns"
      ).length;
      query.mockRestore();

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

      return {
        attempt: await ctx.db.get(attemptId),
        calibrationRunQueryCount,
        placementQueryCount,
        scaleItemQueryCount,
        score,
        sections,
      };
    });

    expect(snapshot).toMatchObject({
      attempt: {
        completedSectionKeys: [FIRST_SECTION, SECOND_SECTION],
        endReason: "time-expired",
        status: "expired",
      },
      calibrationRunQueryCount: 0,
      placementQueryCount: 1,
      scaleItemQueryCount: 1,
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

  it.each([
    {
      expectedCode: "TRYOUT_PLACEMENT_DUPLICATE",
      kind: "duplicate question slot",
    },
    {
      expectedCode: "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      kind: "missing placement row",
    },
    {
      expectedCode: "TRYOUT_PLACEMENT_COUNT_MISMATCH",
      kind: "attempt question total mismatch",
    },
  ])(
    "rejects a $kind before terminal writes",
    async ({ expectedCode, kind }) => {
      const t = createConvexTestWithBetterAuth();
      const seeded = await t.mutation(async (ctx) => {
        const fixture = await seedTryoutContentAccessState(ctx, {
          attemptStatus: "in-progress",
          sectionStatus: "in-progress",
          suffix: `finish-${kind.replaceAll(" ", "-")}`,
        });
        const attempt = await ctx.db.get(fixture.attemptId);
        const placement = await ctx.db.get(fixture.placementId);
        const section = await ctx.db.get(fixture.sectionAttemptId);
        const snapshot = attempt?.sectionSnapshots.at(0);
        if (!(attempt && placement && section && snapshot)) {
          throw new Error("Expected a complete try-out integrity fixture.");
        }

        if (kind === "attempt question total mismatch") {
          await ctx.db.patch(attempt._id, {
            scoreStatus: "official",
            scoringStrategy: "raw",
            totalQuestions: 2,
          });
        } else {
          await ctx.db.patch(attempt._id, {
            scoreStatus: "official",
            scoringStrategy: "raw",
            sectionSnapshots: [{ ...snapshot, questionCount: 2 }],
            totalQuestions: 2,
          });
          await ctx.db.patch(section._id, { totalQuestions: 2 });
        }
        if (kind === "duplicate question slot") {
          const { _creationTime, _id, ...placementValues } = placement;
          await ctx.db.insert("tryoutAttemptPlacements", {
            ...placementValues,
            placementIdentity: `${placement.placementIdentity}\0duplicate`,
          });
        }
        return fixture;
      });

      await expect(
        t.mutation(async (ctx) => {
          const attempt = await ctx.db.get(seeded.attemptId);
          const section = await ctx.db.get(seeded.sectionAttemptId);
          if (!(attempt && section)) {
            throw new Error("Expected one active try-out section.");
          }
          return await runConvexProgram(
            finalizeSectionAttempt(ctx, {
              attempt,
              endReason: "submitted",
              now: NOW + 1000,
              section,
            })
          );
        })
      ).rejects.toMatchObject({ data: { code: expectedCode } });

      const stored = await t.query(async (ctx) => ({
        attempt: await ctx.db.get(seeded.attemptId),
        progress: await ctx.db.query("tryoutSetProgress").collect(),
        scores: await ctx.db.query("tryoutScores").collect(),
        section: await ctx.db.get(seeded.sectionAttemptId),
      }));
      expect(stored.scores).toEqual([]);
      expect(stored.progress).toEqual([]);
      expect(stored.attempt).toMatchObject({
        completedAt: null,
        completedSectionKeys: [],
        endReason: null,
        status: "in-progress",
        totalCorrect: 0,
      });
      expect(stored.section).toMatchObject({
        answeredCount: 0,
        completedAt: null,
        correctAnswers: 0,
        endReason: null,
        status: "in-progress",
      });
      expect(stored.section?.score).toBeUndefined();
    }
  );

  it("completes the parent after its final IRT section with one placement query", async () => {
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
      const signedSectionFixture = makeSignedTryoutSection(section);
      const signedSection = signedSectionFixture.signed;
      const signedPlacement = signedSection.placements.at(0);
      if (!signedPlacement) {
        throw new ConvexError({
          code: "TRYOUT_PLACEMENT_NOT_FOUND",
          message: "Expected one signed try-out placement fixture.",
        });
      }
      const source = makeSignedTryoutSource(set, [signedSectionFixture]);
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW,
        questionCount: 1,
        setIdentity: source.snapshot.setIdentity,
        status: "provisional",
        tryoutSnapshotId: source.snapshot.snapshotId,
      });
      await insertIrtScaleItem(ctx, {
        placement: signedPlacement,
        scaleVersionId,
      });
      const attemptId = await insertTryoutAttempt(ctx, {
        scaleVersionId,
        sectionSnapshots: [tryoutSectionSnapshot({ signed: signedSection })],
        set,
        snapshotId: source.snapshot.snapshotId,
        snapshotReleaseId: source.bundle.releaseId,
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
        createAttemptPlacements(ctx, {
          attempt,
          source,
        })
      );

      const query = vi.spyOn(ctx.db, "query");
      await runConvexProgram(
        finalizeSectionAttempt(ctx, {
          attempt,
          endReason: "time-expired",
          now: NOW,
          section: sectionAttempt,
        })
      );
      const placementQueryCount = query.mock.calls.filter(
        ([tableName]) => tableName === "tryoutAttemptPlacements"
      ).length;
      const scaleItemQueryCount = query.mock.calls.filter(
        ([tableName]) => tableName === "irtScaleItems"
      ).length;
      const calibrationRunQueryCount = query.mock.calls.filter(
        ([tableName]) => tableName === "irtCalibrationRuns"
      ).length;
      query.mockRestore();
      const score = await ctx.db
        .query("tryoutScores")
        .withIndex("by_tryoutAttemptId", (index) =>
          index.eq("tryoutAttemptId", attemptId)
        )
        .unique();

      return {
        attempt: await ctx.db.get(attemptId),
        calibrationRunQueryCount,
        placementQueryCount,
        scaleItemQueryCount,
        score,
        section: await ctx.db.get(sectionId),
      };
    });

    expect(completed).toMatchObject({
      attempt: {
        completedSectionKeys: ["penalaran-matematika"],
        endReason: "submitted",
        status: "completed",
      },
      calibrationRunQueryCount: 0,
      placementQueryCount: 1,
      scaleItemQueryCount: 1,
      score: {
        scoreStatus: "provisional",
        scoringStrategy: "irt",
      },
      section: {
        endReason: "time-expired",
        score: {
          publishedScore: 100,
          scoreStatus: "provisional",
          scoringStrategy: "irt",
        },
        status: "expired",
      },
    });
  });

  it("rejects duplicate snapshot keys before expiry writes", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(async (ctx) => {
      const seeded = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "finish-duplicate-snapshot",
      });
      const attempt = await ctx.db.get(seeded.attemptId);
      const firstSnapshot = attempt?.sectionSnapshots[0];
      if (!(attempt && firstSnapshot)) {
        throw new Error("Expected one frozen try-out section.");
      }
      await ctx.db.patch(attempt._id, {
        scoreStatus: "official",
        scoringStrategy: "raw",
        sectionSnapshots: [
          firstSnapshot,
          {
            ...firstSnapshot,
            sectionIdentity: `${firstSnapshot.sectionIdentity}-duplicate`,
            sectionOrder: 2,
          },
        ],
        totalQuestions: 2,
      });
      return seeded;
    });

    await expect(
      t.mutation(async (ctx) => {
        const attempt = await ctx.db.get(fixture.attemptId);
        if (!attempt) {
          throw new Error("Expected one active try-out attempt.");
        }
        return await runConvexProgram(
          expireAttempt(ctx, { attempt, now: NOW })
        );
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH" },
    });
    const stored = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(fixture.attemptId),
      scores: await ctx.db.query("tryoutScores").collect(),
      section: await ctx.db.get(fixture.sectionAttemptId),
    }));
    expect(stored.scores).toEqual([]);
    expect(stored.attempt).toMatchObject({
      completedSectionKeys: [],
      status: "in-progress",
    });
    expect(stored.section).toMatchObject({ status: "in-progress" });
  });
});
