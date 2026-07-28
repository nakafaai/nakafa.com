import { continueAccountDeletionCommitProgram } from "@repo/backend/convex/auth/deletion/commit";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 10, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

function seedStartedDeletion(t: ReturnType<typeof convexTest>, authId: string) {
  return t.mutation(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      authId,
      credits: 0,
      creditsResetAt: 0,
      deletionPreparedAt: NOW,
      email: `${authId}@example.com`,
      name: authId,
      plan: "free",
    });
    const preparationId = await ctx.db.insert("accountDeletionPreparations", {
      attemptId: ATTEMPT_ID,
      authId,
      deletionStartedAt: NOW,
      readyAt: NOW,
      recoveryAt: NOW,
      recoveryGeneration: 1,
      userId,
    });

    return {
      expectedPreparation: {
        attemptId: ATTEMPT_ID,
        preparationId,
        recoveryGeneration: 1,
      },
      preparationId,
      userId,
    };
  });
}

describe("auth/deletion/commit", () => {
  it.each([
    {
      accountCount: 0,
      expectedAccountCalls: 0,
      sessionCount: 1,
      stage: "sessions",
    },
    {
      accountCount: 1,
      expectedAccountCalls: 1,
      sessionCount: 0,
      stage: "accounts",
    },
  ])("continues after deleting one bounded $stage page", async (testCase) => {
    const t = convexTest(schema, convexModules);
    const seeded = await seedStartedDeletion(t, `${testCase.stage}-owner`);
    const deleteAccounts = vi.fn(async () => testCase.accountCount);
    const deleteAuthUser = vi.fn(async () => undefined);
    const deleteSessions = vi.fn(async () => testCase.sessionCount);
    const scheduleContinuation = vi.fn(async () => undefined);

    const handled = await t.mutation((ctx) =>
      runConvexProgram(
        continueAccountDeletionCommitProgram(
          ctx,
          `${testCase.stage}-owner`,
          seeded.expectedPreparation,
          {
            deleteAccounts,
            deleteAuthUser,
            deleteSessions,
            scheduleContinuation,
          }
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.get(
        "accountDeletionPreparations",
        seeded.preparationId
      ),
      user: await ctx.db.get("users", seeded.userId),
    }));

    expect(handled).toBe(true);
    expect(deleteSessions).toHaveBeenCalledOnce();
    expect(deleteAccounts).toHaveBeenCalledTimes(testCase.expectedAccountCalls);
    expect(deleteAuthUser).not.toHaveBeenCalled();
    expect(scheduleContinuation).toHaveBeenCalledOnce();
    expect(state.preparation).not.toHaveProperty("finalizedAt");
    expect(state.user).not.toHaveProperty("deletedAt");
  });

  it("deletes the auth user and finalizes the app record atomically", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await seedStartedDeletion(t, "final-commit-owner");
    const deleteAuthUser = vi.fn(async () => undefined);

    const handled = await t.mutation((ctx) =>
      runConvexProgram(
        continueAccountDeletionCommitProgram(
          ctx,
          "final-commit-owner",
          seeded.expectedPreparation,
          {
            deleteAccounts: vi.fn(async () => 0),
            deleteAuthUser,
            deleteSessions: vi.fn(async () => 0),
            scheduleContinuation: vi.fn(async () => undefined),
          }
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.get(
        "accountDeletionPreparations",
        seeded.preparationId
      ),
      receipt: await ctx.db.query("accountDeletionReceipts").unique(),
      user: await ctx.db.get("users", seeded.userId),
    }));

    expect(handled).toBe(true);
    expect(deleteAuthUser).toHaveBeenCalledOnce();
    expect(state.preparation?.finalizedAt).toEqual(expect.any(Number));
    expect(state.receipt?.attemptId).toBe(ATTEMPT_ID);
    expect(state.user).toMatchObject({
      authId: `deleted:${seeded.userId}`,
      deletedAt: expect.any(Number),
      email: `deleted-${seeded.userId}@account.nakafa.invalid`,
      name: "Deleted user",
    });
  });

  it("does not touch auth before the irreversible claim", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await seedStartedDeletion(t, "unclaimed-owner");
    await t.mutation((ctx) =>
      ctx.db.patch("accountDeletionPreparations", seeded.preparationId, {
        deletionStartedAt: undefined,
      })
    );
    const deleteAuthUser = vi.fn(async () => undefined);
    const deleteSessions = vi.fn(async () => 0);

    const handled = await t.mutation((ctx) =>
      runConvexProgram(
        continueAccountDeletionCommitProgram(
          ctx,
          "unclaimed-owner",
          seeded.expectedPreparation,
          {
            deleteAccounts: vi.fn(async () => 0),
            deleteAuthUser,
            deleteSessions,
            scheduleContinuation: vi.fn(async () => undefined),
          }
        )
      )
    );

    expect(handled).toBe(false);
    expect(deleteSessions).not.toHaveBeenCalled();
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });
});
