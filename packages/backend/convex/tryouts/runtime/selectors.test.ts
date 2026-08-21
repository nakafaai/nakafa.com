import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { loadTryoutSignedContent } from "@repo/backend/convex/tryouts/runtime/selectors";
import {
  TEST_STORED_TRYOUT_PLACEMENT,
  TEST_STORED_TRYOUT_RELEASE_ID,
  TEST_STORED_TRYOUT_SNAPSHOT_ID,
} from "@repo/backend/test/tryout-history";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout-runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { Cause, Effect, Exit, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
});
describe("tryouts/runtime/selectors", () => {
  it("returns signed selectors for the active attempt", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-signed-active",
      })
    );
    const content = await t.query(async (ctx) => {
      const attempt = await ctx.db.get(seeded.attemptId);
      if (!(attempt?.snapshotReleaseId && attempt.tryoutSnapshotId)) {
        throw new Error("Expected a signed attempt fixture.");
      }
      return Effect.runPromise(
        loadTryoutSignedContent({
          answers: false,
          attempt,
          ctx,
          appLocale: "id",
          sectionKey: TRYOUT_SECTION_KEY,
          snapshotId: attempt.tryoutSnapshotId,
          snapshotReleaseId: attempt.snapshotReleaseId,
          totalQuestions: 1,
        })
      );
    });
    expect(content).toEqual({
      answers: [],
      kind: "signed",
      questions: [seeded.signedContent.question],
      runtime: "current",
    });
  });
  it("returns entitled answer selectors only after terminal review", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "content-signed-review",
      })
    );
    const content = await t.query(async (ctx) => {
      const attempt = await ctx.db.get(seeded.attemptId);
      if (!(attempt?.snapshotReleaseId && attempt.tryoutSnapshotId)) {
        throw new Error("Expected a signed attempt fixture.");
      }
      return Effect.runPromise(
        loadTryoutSignedContent({
          answers: true,
          attempt,
          ctx,
          appLocale: "id",
          sectionKey: TRYOUT_SECTION_KEY,
          snapshotId: attempt.tryoutSnapshotId,
          snapshotReleaseId: attempt.snapshotReleaseId,
          totalQuestions: 1,
        })
      );
    });
    expect(content).toEqual({
      answers: [seeded.signedContent.answer],
      kind: "signed",
      questions: [seeded.signedContent.question],
      runtime: "current",
    });
  });
  it("selects authenticated history only through an attempt marker", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "content-stored-review",
      });
      if (!fixture.placementId) {
        throw new Error("Expected one frozen placement fixture.");
      }
      const historical = TEST_STORED_TRYOUT_PLACEMENT.record.row;
      await ctx.db.patch(fixture.attemptId, {
        appLocale: "id",
        snapshotReleaseId: TEST_STORED_TRYOUT_RELEASE_ID,
        tryoutSnapshotId: TEST_STORED_TRYOUT_SNAPSHOT_ID,
      });
      await ctx.db.patch(fixture.placementId, {
        answerArtifactHash: historical.answerArtifactHash,
        answerContentKey: historical.answerContentKey,
        choiceSnapshots: [...historical.choices],
        contentHash: historical.contentHash,
        placementRowHash: TEST_STORED_TRYOUT_PLACEMENT.record.rowHash,
        questionArtifactHash: historical.questionArtifactHash,
        questionContentKey: historical.questionContentKey,
        questionOrder: historical.questionOrder,
        rendererDomain: historical.rendererDomain,
        sectionKey: historical.sectionKey,
        sourcePath: historical.questionSourcePath,
        sourceRevision: historical.sourceRevision,
      });
      await ctx.db.insert("tryoutHistoryRows", {
        answerArtifactHash: historical.answerArtifactHash,
        index: 0,
        questionArtifactHash: historical.questionArtifactHash,
        rowHash: TEST_STORED_TRYOUT_PLACEMENT.record.rowHash,
        rowJson: JSON.stringify(TEST_STORED_TRYOUT_PLACEMENT),
        rowKind: "placement",
        snapshotId: TEST_STORED_TRYOUT_SNAPSHOT_ID,
      });
      await ctx.db.insert("tryoutAttemptHistory", {
        snapshotReleaseId: TEST_STORED_TRYOUT_RELEASE_ID,
        tryoutAttemptId: fixture.attemptId,
        tryoutSnapshotId: TEST_STORED_TRYOUT_SNAPSHOT_ID,
      });
      return fixture;
    });
    const content = await t.query(async (ctx) => {
      const attempt = await ctx.db.get("tryoutAttempts", seeded.attemptId);
      if (!attempt) {
        throw new Error("Expected one retained attempt fixture.");
      }
      return Effect.runPromise(
        loadTryoutSignedContent({
          answers: true,
          appLocale: "id",
          attempt,
          ctx,
          sectionKey: TEST_STORED_TRYOUT_PLACEMENT.record.row.sectionKey,
          snapshotId: TEST_STORED_TRYOUT_SNAPSHOT_ID,
          snapshotReleaseId: TEST_STORED_TRYOUT_RELEASE_ID,
          totalQuestions: 1,
        })
      );
    });
    expect(content).toMatchObject({
      answers: [
        {
          appLocale: "id",
          artifactLocale: "en",
          delivery: "entitled",
        },
      ],
      attemptId: seeded.attemptId,
      kind: "signed",
      questions: [
        {
          appLocale: "id",
          artifactLocale: "en",
          delivery: "authenticated",
        },
      ],
      runtime: "history",
    });
  });
  it("fails closed when signed attempt locale identity drifts", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-signed-locale",
      });
      await ctx.db.patch(fixture.attemptId, { appLocale: "en" });
      return fixture;
    });
    await expect(
      t.query(async (ctx) => {
        const attempt = await ctx.db.get(seeded.attemptId);
        if (!(attempt?.snapshotReleaseId && attempt.tryoutSnapshotId)) {
          throw new Error("Expected a signed attempt fixture.");
        }
        return Effect.runPromise(
          loadTryoutSignedContent({
            answers: false,
            attempt,
            ctx,
            appLocale: "id",
            sectionKey: TRYOUT_SECTION_KEY,
            snapshotId: attempt.tryoutSnapshotId,
            snapshotReleaseId: attempt.snapshotReleaseId,
            totalQuestions: 1,
          })
        );
      })
    ).rejects.toThrow(
      "Signed try-out attempt lost its locale or snapshot identity."
    );
  });
  it("fails closed when one signed placement is missing", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-signed-placement",
      });
      if (!fixture.placementId) {
        throw new Error("Expected a signed placement fixture.");
      }
      await ctx.db.delete(fixture.placementId);
      return fixture;
    });
    await expect(
      t.query(async (ctx) => {
        const attempt = await ctx.db.get(seeded.attemptId);
        if (!(attempt?.snapshotReleaseId && attempt.tryoutSnapshotId)) {
          throw new Error("Expected a signed attempt fixture.");
        }
        return Effect.runPromise(
          loadTryoutSignedContent({
            answers: false,
            attempt,
            ctx,
            appLocale: "id",
            sectionKey: TRYOUT_SECTION_KEY,
            snapshotId: attempt.tryoutSnapshotId,
            snapshotReleaseId: attempt.snapshotReleaseId,
            totalQuestions: 1,
          })
        );
      })
    ).rejects.toThrow(
      "Signed try-out section lost one or more frozen placements."
    );
  });
  it("maps placement read failures into the typed selector error", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "content-selector-read-failure",
      })
    );
    const failure = await t.query(async (ctx) => {
      const attempt = await ctx.db.get(seeded.attemptId);
      if (!(attempt?.snapshotReleaseId && attempt.tryoutSnapshotId)) {
        throw new Error("Expected a signed attempt fixture.");
      }
      vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
        throw new Error("Injected selector read failure.");
      });
      const exit = await Effect.runPromiseExit(
        loadTryoutSignedContent({
          answers: false,
          attempt,
          ctx,
          appLocale: "id",
          sectionKey: TRYOUT_SECTION_KEY,
          snapshotId: attempt.tryoutSnapshotId,
          snapshotReleaseId: attempt.snapshotReleaseId,
          totalQuestions: 1,
        })
      );
      if (Exit.isSuccess(exit)) {
        throw new Error("Expected selector resolution to fail.");
      }
      const error = Cause.findErrorOption(exit.cause);
      if (Option.isNone(error)) {
        throw new Error("Expected a typed selector failure.");
      }
      return {
        code: error.value.code,
        message: error.value.message,
        tag: error.value._tag,
      };
    });
    expect(failure).toMatchObject({
      code: "TRYOUT_SELECTOR_INTEGRITY",
      message: "Unable to read signed try-out selectors.",
      tag: "TryoutSelectorReadError",
    });
  });
});
