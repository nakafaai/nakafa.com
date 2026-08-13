import { internal } from "@repo/backend/convex/_generated/api";
import { cleanupUserTryouts } from "@repo/backend/convex/auth/cleanup/tryouts";
import { ensureTryoutLifecycleWritable } from "@repo/backend/convex/contentRelease/cutover/tryouts";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress/write";
import {
  insertTryoutAttempt,
  insertTryoutUser,
} from "@repo/backend/test/tryout-runtime";
import { makeTryoutSet } from "@repo/backend/test/tryouts";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/tryouts", () => {
  it("blocks progress and account cleanup while the checkpoint exists", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(async (ctx) => {
      const userId = await insertTryoutUser(ctx, {
        authId: "cutover-tryout-user",
        email: "cutover-tryout@example.com",
        name: "Cutover Tryout",
      });
      const set = makeTryoutSet();
      const attemptId = await insertTryoutAttempt(ctx, {
        sectionSnapshots: [],
        set,
        userId,
      });
      const attempt = await ctx.db.get(attemptId);
      if (!attempt) {
        throw new Error("Expected cutover attempt fixture.");
      }
      await ctx.db.insert("contentCutoverState", {
        auditedActiveReleaseId: "active-release",
        auditedActiveSequence: 1,
        auditedAt: 1,
        auditedLegacyWriteVersion: 0,
        auditedNextSequence: 2,
        currentDeleted: 0,
        currentTableDeleted: 0,
        currentTableIndex: 0,
        currentTablePreserved: 0,
        inventoryVersion: "production-2026-08-13",
        key: "phase1",
        legacyDeleted: 0,
        legacyTableDeleted: 0,
        legacyTableIndex: 0,
        phase: "audited",
        updatedAt: 1,
      });
      return { attempt, userId };
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          writeTryoutSetProgress(ctx, {
            attempt: fixture.attempt,
            publishedScore: null,
            status: "in-progress",
            updatedAt: 2,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_CUTOVER_FROZEN" },
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(cleanupUserTryouts(ctx, fixture.userId))
      )
    ).rejects.toMatchObject({
      data: { code: "USER_CLEANUP_FAILED" },
    });
    await expect(
      t.mutation(internal.tryouts.mutations.expiry.sweep, {})
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_CUTOVER_FROZEN" },
    });
    await expect(
      t.query((ctx) => ctx.db.get("tryoutAttempts", fixture.attempt._id))
    ).resolves.not.toBeNull();
  });

  it("allows lifecycle writes before initialization", async () => {
    const t = convexTest(schema, convexModules);
    await expect(
      t.mutation((ctx) => runConvexProgram(ensureTryoutLifecycleWritable(ctx)))
    ).resolves.toBeNull();
  });
});
