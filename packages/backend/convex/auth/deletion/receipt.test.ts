import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  getAccountDeletionAttemptStatusProgram,
  recordAccountDeletionReceipt,
  sweepAccountDeletionReceiptsProgram,
} from "@repo/backend/convex/auth/deletion/receipt";
import { accountDeletionAttemptStatus } from "@repo/backend/convex/auth/deletion/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const COMMITTED_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const PENDING_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0621";
const DELETED_AUTH_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0622";
const UNKNOWN_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0623";
const FINALIZED_ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0624";

function insertUser(ctx: MutationCtx, authId: string) {
  return ctx.db.insert("users", {
    authId,
    credits: 0,
    creditsResetAt: 0,
    email: `${authId}@example.com`,
    name: authId,
    plan: "free",
  });
}

describe("auth/deletion/receipt", () => {
  it("distinguishes committed, pending, and unknown browser attempts", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const pendingUserId = await insertUser(ctx, "pending-auth");
      const deletedAuthUserId = await insertUser(ctx, "deleted-auth");

      await ctx.db.insert("accountDeletionReceipts", {
        attemptId: COMMITTED_ATTEMPT_ID,
        committedAt: 1,
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: PENDING_ATTEMPT_ID,
        authId: "pending-auth",
        recoveryGeneration: 0,
        userId: pendingUserId,
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: DELETED_AUTH_ATTEMPT_ID,
        authId: "deleted-auth",
        recoveryGeneration: 0,
        userId: deletedAuthUserId,
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: FINALIZED_ATTEMPT_ID,
        authId: "pending-auth",
        finalizedAt: 1,
        recoveryGeneration: 0,
        userId: pendingUserId,
      });
    });
    const authUserExists = vi.fn(async (authId: string) =>
      Promise.resolve(authId === "pending-auth")
    );
    const getStatus = (attemptId: string) =>
      t.query((ctx) =>
        runConvexProgram(
          getAccountDeletionAttemptStatusProgram(ctx, attemptId, authUserExists)
        )
      );

    await expect(getStatus(COMMITTED_ATTEMPT_ID)).resolves.toBe(
      accountDeletionAttemptStatus.committed
    );
    await expect(getStatus(PENDING_ATTEMPT_ID)).resolves.toBe(
      accountDeletionAttemptStatus.pending
    );
    await expect(getStatus(DELETED_AUTH_ATTEMPT_ID)).resolves.toBe(
      accountDeletionAttemptStatus.committed
    );
    await expect(getStatus(FINALIZED_ATTEMPT_ID)).resolves.toBe(
      accountDeletionAttemptStatus.committed
    );
    await expect(getStatus(UNKNOWN_ATTEMPT_ID)).resolves.toBe(
      accountDeletionAttemptStatus.unknown
    );
    expect(authUserExists).toHaveBeenCalledTimes(2);
  });

  it("records one idempotent privacy-minimal receipt", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await runConvexProgram(
        recordAccountDeletionReceipt(ctx, COMMITTED_ATTEMPT_ID, 1)
      );
      await runConvexProgram(
        recordAccountDeletionReceipt(ctx, COMMITTED_ATTEMPT_ID, 2)
      );
      await runConvexProgram(recordAccountDeletionReceipt(ctx, undefined, 3));
    });
    const receipts = await t.query((ctx) =>
      ctx.db.query("accountDeletionReceipts").collect()
    );

    expect(receipts).toEqual([
      expect.objectContaining({
        attemptId: COMMITTED_ATTEMPT_ID,
        committedAt: 1,
      }),
    ]);
  });

  it("deletes expired receipts in bounded pages", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (let index = 0; index <= 50; index += 1) {
        await ctx.db.insert("accountDeletionReceipts", {
          attemptId: `expired-${index}`,
          committedAt: 0,
        });
      }
      await ctx.db.insert("accountDeletionReceipts", {
        attemptId: "future",
        committedAt: Number.MAX_SAFE_INTEGER,
      });
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(sweepAccountDeletionReceiptsProgram(ctx))
      )
    ).resolves.toBe(true);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(sweepAccountDeletionReceiptsProgram(ctx))
      )
    ).resolves.toBe(false);
    const receipts = await t.query((ctx) =>
      ctx.db.query("accountDeletionReceipts").collect()
    );

    expect(receipts).toEqual([
      expect.objectContaining({
        attemptId: "future",
      }),
    ]);
  });
});
