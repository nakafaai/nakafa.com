import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { finalizeSectionAttempt } from "@repo/backend/convex/tryouts/runtime/finish";
import { loadSectionIrtSource } from "@repo/backend/convex/tryouts/runtime/irt/items";
import {
  createAttemptPlacements,
  loadAttemptPlacements,
} from "@repo/backend/convex/tryouts/runtime/placement";
import { loadAttemptResponses } from "@repo/backend/convex/tryouts/runtime/response";
import {
  finalizeAttemptScore,
  loadAttemptScoreSource,
} from "@repo/backend/convex/tryouts/runtime/score";
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
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
const FIRST_SECTION = "pengetahuan-kuantitatif";
const SECOND_SECTION = "penalaran-matematika";

type TryoutAttempt = Doc<"tryoutAttempts">;

/** Finalizes through the same validated response graph as production. */
const finalizeLoadedIrtAttempt = Effect.fn(
  "tryouts.runtime.test.finalizeLoadedIrtAttempt"
)(function* (ctx: MutationCtx, attempt: TryoutAttempt) {
  const placements = yield* loadAttemptPlacements(ctx, attempt);
  const responseIndex = yield* loadAttemptResponses(
    ctx,
    attempt,
    placements,
    "complete"
  );
  const source = yield* loadAttemptScoreSource(
    ctx,
    attempt,
    responseIndex.placements
  );

  return yield* finalizeAttemptScore(ctx, {
    attempt,
    endReason: "submitted",
    now: NOW,
    responseIndex,
    source,
  });
});

describe("tryouts/runtime/irt", () => {
  it("loads one isolated section with two fixed indexed queries", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const userId = await insertTryoutUser(ctx, {
        authId: "auth-irt-section-source",
        email: "irt-section-source@example.com",
        name: "IRT Section Source",
      });
      const set = makeTryoutSet({ questionCount: 2 });
      const section = makeTryoutSection({ questionCount: 2 });
      const signedSection = makeSignedTryoutSection(section);
      const source = makeSignedTryoutSource(set, [signedSection]);
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW,
        questionCount: 2,
        setIdentity: source.snapshot.setIdentity,
        status: "provisional",
        tryoutSnapshotId: source.snapshot.snapshotId,
      });
      for (const placement of signedSection.signed.placements) {
        await insertIrtScaleItem(ctx, { placement, scaleVersionId });
      }
      const snapshot = tryoutSectionSnapshot({ signed: signedSection.signed });
      const attemptId = await insertTryoutAttempt(ctx, {
        scaleVersionId,
        sectionSnapshots: [snapshot],
        set,
        snapshotId: source.snapshot.snapshotId,
        snapshotReleaseId: source.bundle.releaseId,
        userId,
      });
      const attempt = await ctx.db.get(attemptId);
      if (!attempt) {
        throw new Error("Expected one active IRT attempt fixture.");
      }
      await runConvexProgram(createAttemptPlacements(ctx, { attempt, source }));
      const placements = await runConvexProgram(
        loadAttemptPlacements(ctx, attempt)
      );

      const query = vi.spyOn(ctx.db, "query");
      const sectionSource = await runConvexProgram(
        loadSectionIrtSource(ctx, {
          attempt,
          placements,
          sectionIdentity: snapshot.sectionIdentity,
        })
      );
      const calibrationRunQueries = query.mock.calls.filter(
        ([tableName]) => tableName === "irtCalibrationRuns"
      ).length;
      const scaleItemQueries = query.mock.calls.filter(
        ([tableName]) => tableName === "irtScaleItems"
      ).length;
      query.mockRestore();

      return {
        calibrationRunQueries,
        itemCount: sectionSource.items.length,
        scaleItemQueries,
      };
    });

    expect(result).toEqual({
      calibrationRunQueries: 1,
      itemCount: 2,
      scaleItemQueries: 1,
    });
  });

  it.each([
    {
      expectedCode: "TRYOUT_IRT_ITEM_DUPLICATE",
      kind: "duplicate item identity",
    },
    {
      expectedCode: "TRYOUT_IRT_ITEM_INVALID",
      kind: "invalid discrimination",
    },
    {
      expectedCode: "TRYOUT_IRT_ITEM_INVALID",
      kind: "non-finite discrimination",
    },
    {
      expectedCode: "TRYOUT_IRT_ITEM_INVALID",
      kind: "non-finite difficulty",
    },
    {
      expectedCode: "TRYOUT_IRT_ITEM_STALE",
      kind: "stale placement hash",
    },
  ])("rejects $kind before terminal writes", async ({ expectedCode, kind }) => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(async (ctx) => {
      const userId = await insertTryoutUser(ctx, {
        authId: `auth-irt-${kind}`,
        email: `irt-${kind.replaceAll(" ", "-")}@example.com`,
        name: `IRT ${kind}`,
      });
      const set = makeTryoutSet({ questionCount: 2 });
      const section = makeTryoutSection({ questionCount: 2 });
      const signedSection = makeSignedTryoutSection(section);
      const source = makeSignedTryoutSource(set, [signedSection]);
      const firstPlacement = signedSection.signed.placements[0];
      const secondPlacement = signedSection.signed.placements[1];
      if (!(firstPlacement && secondPlacement)) {
        throw new Error("Expected two signed IRT placement fixtures.");
      }

      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW,
        questionCount: 2,
        setIdentity: source.snapshot.setIdentity,
        status: "provisional",
        tryoutSnapshotId: source.snapshot.snapshotId,
      });
      const firstItemId = await insertIrtScaleItem(ctx, {
        placement: firstPlacement,
        scaleVersionId,
      });
      if (kind === "duplicate item identity") {
        await insertIrtScaleItem(ctx, {
          placement: firstPlacement,
          scaleVersionId,
        });
      } else {
        await insertIrtScaleItem(ctx, {
          placement: secondPlacement,
          scaleVersionId,
        });
      }
      if (kind === "invalid discrimination") {
        await ctx.db.patch(firstItemId, { discrimination: 0 });
      }
      if (kind === "non-finite discrimination") {
        await ctx.db.patch(firstItemId, { discrimination: Number.NaN });
      }
      if (kind === "non-finite difficulty") {
        await ctx.db.patch(firstItemId, {
          difficulty: Number.POSITIVE_INFINITY,
        });
      }
      if (kind === "stale placement hash") {
        await ctx.db.patch(firstItemId, {
          placementRowHash: `${firstPlacement.rowHash}-stale`,
        });
      }

      const attemptId = await insertTryoutAttempt(ctx, {
        scaleVersionId,
        sectionSnapshots: [
          tryoutSectionSnapshot({ signed: signedSection.signed }),
        ],
        set,
        snapshotId: source.snapshot.snapshotId,
        snapshotReleaseId: source.bundle.releaseId,
        userId,
      });
      const sectionAttemptId = await insertTryoutSectionAttempt(ctx, {
        totalQuestions: 2,
        tryoutAttemptId: attemptId,
      });
      const attempt = await ctx.db.get(attemptId);
      if (!attempt) {
        throw new Error("Expected one active IRT attempt fixture.");
      }
      await runConvexProgram(createAttemptPlacements(ctx, { attempt, source }));

      return { attemptId, sectionAttemptId };
    });

    await expect(
      t.mutation(async (ctx) => {
        const attempt = await ctx.db.get(fixture.attemptId);
        if (!attempt) {
          throw new Error("Expected one active IRT attempt.");
        }
        return await runConvexProgram(finalizeLoadedIrtAttempt(ctx, attempt));
      })
    ).rejects.toMatchObject({ data: { code: expectedCode } });

    const stored = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(fixture.attemptId),
      progress: await ctx.db.query("tryoutSetProgress").collect(),
      scores: await ctx.db.query("tryoutScores").collect(),
      section: await ctx.db.get(fixture.sectionAttemptId),
    }));
    expect(stored.scores).toEqual([]);
    expect(stored.progress).toEqual([]);
    expect(stored.attempt).toMatchObject({
      completedAt: null,
      endReason: null,
      status: "in-progress",
      totalCorrect: 0,
    });
    expect(stored.section).toMatchObject({
      completedAt: null,
      endReason: null,
      status: "in-progress",
    });
  });

  it("rolls back final-section writes when an earlier IRT item is invalid", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(async (ctx) => {
      const userId = await insertTryoutUser(ctx, {
        authId: "auth-irt-late-rollback",
        email: "irt-late-rollback@example.com",
        name: "IRT Late Rollback",
      });
      const set = makeTryoutSet({
        questionCount: 2,
        sectionCount: 2,
        visibleSectionCount: 2,
      });
      const firstSignedSection = makeSignedTryoutSection(
        makeTryoutSection({ sectionKey: FIRST_SECTION })
      );
      const secondSignedSection = makeSignedTryoutSection(
        makeTryoutSection({ order: 2, sectionKey: SECOND_SECTION })
      );
      const source = makeSignedTryoutSource(set, [
        firstSignedSection,
        secondSignedSection,
      ]);
      const firstPlacement = firstSignedSection.signed.placements[0];
      const secondPlacement = secondSignedSection.signed.placements[0];
      if (!(firstPlacement && secondPlacement)) {
        throw new Error("Expected two signed IRT placement fixtures.");
      }
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW,
        questionCount: 2,
        setIdentity: source.snapshot.setIdentity,
        status: "provisional",
        tryoutSnapshotId: source.snapshot.snapshotId,
      });
      const invalidItemId = await insertIrtScaleItem(ctx, {
        placement: firstPlacement,
        scaleVersionId,
      });
      await ctx.db.patch(invalidItemId, { discrimination: 0 });
      await insertIrtScaleItem(ctx, {
        placement: secondPlacement,
        scaleVersionId,
      });

      const sectionSnapshots = [
        tryoutSectionSnapshot({ signed: firstSignedSection.signed }),
        tryoutSectionSnapshot({ signed: secondSignedSection.signed }),
      ];
      const attemptId = await insertTryoutAttempt(ctx, {
        scaleVersionId,
        sectionSnapshots,
        set,
        snapshotId: source.snapshot.snapshotId,
        snapshotReleaseId: source.bundle.releaseId,
        userId,
      });
      await ctx.db.patch(attemptId, { completedSectionKeys: [FIRST_SECTION] });
      const firstSectionAttemptId = await insertTryoutSectionAttempt(ctx, {
        sectionKey: FIRST_SECTION,
        tryoutAttemptId: attemptId,
      });
      await ctx.db.patch(firstSectionAttemptId, {
        completedAt: NOW - 1000,
        endReason: "submitted",
        status: "completed",
      });
      const finalSectionAttemptId = await insertTryoutSectionAttempt(ctx, {
        sectionKey: SECOND_SECTION,
        sectionOrder: 2,
        tryoutAttemptId: attemptId,
      });
      const attempt = await ctx.db.get(attemptId);
      if (!attempt) {
        throw new Error("Expected one active IRT attempt fixture.");
      }
      await runConvexProgram(createAttemptPlacements(ctx, { attempt, source }));

      return {
        attemptId,
        finalSectionAttemptId,
        firstSectionAttemptId,
      };
    });

    await expect(
      t.mutation(async (ctx) => {
        const attempt = await ctx.db.get(fixture.attemptId);
        const section = await ctx.db.get(fixture.finalSectionAttemptId);
        if (!(attempt && section)) {
          throw new Error("Expected one active final IRT section.");
        }
        return await runConvexProgram(
          finalizeSectionAttempt(ctx, {
            attempt,
            endReason: "submitted",
            now: NOW,
            section,
          })
        );
      })
    ).rejects.toMatchObject({ data: { code: "TRYOUT_IRT_ITEM_INVALID" } });

    const stored = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(fixture.attemptId),
      finalSection: await ctx.db.get(fixture.finalSectionAttemptId),
      firstSection: await ctx.db.get(fixture.firstSectionAttemptId),
      progress: await ctx.db.query("tryoutSetProgress").collect(),
      scores: await ctx.db.query("tryoutScores").collect(),
    }));
    expect(stored.scores).toEqual([]);
    expect(stored.progress).toEqual([]);
    expect(stored.attempt).toMatchObject({
      completedAt: null,
      completedSectionKeys: [FIRST_SECTION],
      endReason: null,
      status: "in-progress",
      totalCorrect: 0,
    });
    expect(stored.firstSection).toMatchObject({
      endReason: "submitted",
      status: "completed",
    });
    expect(stored.finalSection).toMatchObject({
      answeredCount: 0,
      completedAt: null,
      correctAnswers: 0,
      endReason: null,
      status: "in-progress",
    });
    expect(stored.finalSection?.score).toBeUndefined();
  });
});
