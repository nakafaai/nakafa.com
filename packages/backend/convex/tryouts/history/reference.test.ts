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
  it("reads and atomically deletes an exact attempt-owned marker", async () => {
    const t = convexTest(schema, convexModules);
    const state = await t.mutation(async (ctx) => {
      const userId = await insertTryoutUser(ctx, {
        authId: "history-reference-user",
        email: "history-reference@example.com",
        name: "History Reference",
      });
      const snapshotId = `sha256:${"a".repeat(64)}`;
      const attemptId = await insertTryoutAttempt(ctx, {
        sectionSnapshots: [],
        set: makeTryoutSet(),
        snapshotId,
        snapshotReleaseId: "retained-release",
        userId,
      });
      const historyId = await ctx.db.insert("tryoutAttemptHistory", {
        snapshotReleaseId: "retained-release",
        tryoutAttemptId: attemptId,
        tryoutSnapshotId: snapshotId,
      });
      return { attemptId, historyId };
    });

    await t.mutation(async (ctx) => {
      const attempt = await ctx.db.get("tryoutAttempts", state.attemptId);
      if (!attempt) {
        throw new Error("Expected retained attempt.");
      }
      const before = await runConvexProgram(
        readTryoutAttemptHistory(ctx, attempt)
      );
      expect(before?._id).toBe(state.historyId);
      await runConvexProgram(deleteTryoutAttemptHistory(ctx, attempt));
    });
    await expect(
      t.query((ctx) => ctx.db.get("tryoutAttemptHistory", state.historyId))
    ).resolves.toBeNull();
  });
});
