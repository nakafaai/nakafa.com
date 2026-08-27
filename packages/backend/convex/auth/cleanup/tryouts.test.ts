import { describe, expect, it } from "@effect/vitest";
import { cleanupUserTryouts } from "@repo/backend/convex/auth/cleanup/tryouts";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Effect } from "effect";

describe("auth/cleanup/tryouts", () => {
  it.effect("preserves an attempt held by signed migration", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const runtime = await seedTryoutContentAccessState(ctx, {
            attemptStatus: "completed",
            sectionStatus: "completed",
            suffix: "cleanup-migration-hold",
          });
          const attempt = await ctx.db.get(runtime.attemptId);
          if (!attempt) {
            throw new Error("Expected held cleanup attempt.");
          }
          const markerId = await ctx.db.insert("tryoutAttemptHistory", {
            snapshotReleaseId: attempt.snapshotReleaseId,
            tryoutAttemptId: attempt._id,
            tryoutSnapshotId: attempt.tryoutSnapshotId,
          });
          await ctx.db.insert("tryoutHistoryAttemptMigrationAudits", {
            migrationId: "cleanup-migration-hold",
            phase: "pending",
            sourceDigest: "source-digest",
            tryoutAttemptHistoryId: markerId,
            tryoutAttemptId: attempt._id,
            userId: attempt.userId,
          });
          return { attemptId: attempt._id, userId: attempt.userId };
        })
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(cleanupUserTryouts(ctx, seeded.userId))
          )
        ).rejects.toMatchObject({
          data: { code: "USER_CLEANUP_FAILED" },
        })
      );
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          attempt: await ctx.db.get(seeded.attemptId),
          placements: await ctx.db
            .query("tryoutAttemptPlacements")
            .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
              query.eq("tryoutAttemptId", seeded.attemptId)
            )
            .collect(),
          sections: await ctx.db
            .query("tryoutSectionAttempts")
            .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
              query.eq("tryoutAttemptId", seeded.attemptId)
            )
            .collect(),
        }))
      );

      expect(state.attempt).not.toBeNull();
      expect(state.placements).toHaveLength(1);
      expect(state.sections).toHaveLength(1);
    })
  );
});
