import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  deleteTryoutAttemptHistory,
  readTryoutAttemptHistory,
} from "@repo/backend/convex/tryouts/history/reference";
import {
  insertTryoutAttempt,
  insertTryoutUser,
} from "@repo/backend/test/tryout-runtime";
import { makeTryoutSet } from "@repo/backend/test/tryouts";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/history/reference", () => {
  it("reads and deletes an exact attempt-owned history reference", async () => {
    const t = convexTest(schema, convexModules);
    const state = await t.mutation(async (ctx) => {
      const userId = await insertTryoutUser(ctx, {
        authId: "history-reference-user",
        email: "history-reference@example.com",
        name: "History Reference",
      });
      const attemptId = await insertTryoutAttempt(ctx, {
        sectionSnapshots: [],
        set: makeTryoutSet({ questionCount: 1 }),
        snapshotId: `sha256:${"a".repeat(64)}`,
        snapshotReleaseId: "retained-release",
        userId,
      });
      const historyId = await ctx.db.insert("tryoutAttemptHistory", {
        snapshotReleaseId: "retained-release",
        tryoutAttemptId: attemptId,
        tryoutSnapshotId: `sha256:${"a".repeat(64)}`,
      });
      return { attemptId, historyId };
    });

    const before = await t.query(async (ctx) => {
      const attempt = await ctx.db.get("tryoutAttempts", state.attemptId);
      if (!attempt) {
        throw new Error("Expected retained attempt.");
      }
      return runConvexProgram(readTryoutAttemptHistory(ctx, attempt));
    });
    expect(before?._id).toBe(state.historyId);

    await t.mutation(async (ctx) => {
      const attempt = await ctx.db.get("tryoutAttempts", state.attemptId);
      if (!attempt) {
        throw new Error("Expected retained attempt.");
      }
      await runConvexProgram(deleteTryoutAttemptHistory(ctx, attempt));
    });
    await expect(
      t.query((ctx) => ctx.db.get("tryoutAttemptHistory", state.historyId))
    ).resolves.toBeNull();
  });

  it("fails closed when a reference drifts from its attempt", async () => {
    const t = convexTest(schema, convexModules);
    const attemptId = await t.mutation(async (ctx) => {
      const userId = await insertTryoutUser(ctx, {
        authId: "history-reference-drift-user",
        email: "history-reference-drift@example.com",
        name: "History Reference Drift",
      });
      const id = await insertTryoutAttempt(ctx, {
        sectionSnapshots: [],
        set: makeTryoutSet({ questionCount: 1 }),
        snapshotId: `sha256:${"b".repeat(64)}`,
        snapshotReleaseId: "expected-release",
        userId,
      });
      await ctx.db.insert("tryoutAttemptHistory", {
        snapshotReleaseId: "different-release",
        tryoutAttemptId: id,
        tryoutSnapshotId: `sha256:${"b".repeat(64)}`,
      });
      return id;
    });

    await expect(
      t.query(async (ctx) => {
        const attempt = await ctx.db.get("tryoutAttempts", attemptId);
        if (!attempt) {
          throw new Error("Expected retained attempt.");
        }
        return runConvexProgram(readTryoutAttemptHistory(ctx, attempt));
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_REFERENCE_MISMATCH" },
    });
  });
});
