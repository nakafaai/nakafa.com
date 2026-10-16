import { RegisteredConvexFunction } from "@confect/server";
import { afterEach, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  cancelAccountDeletionAttempt,
  cancelAccountDeletionAttemptByToken,
} from "@repo/backend/confect/auth/deletion/attemptCancellation";
import { claimAccountDeletion } from "@repo/backend/confect/auth/deletion/claim";
import {
  accountDeletionCancellationOutcome,
  accountDeletionPreparationOutcome,
} from "@repo/backend/confect/auth/deletion/spec";
import { authReader } from "@repo/backend/confect/auth/reader";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 6, 28, 9, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
describe("auth/deletion/attemptCancellation", () => {
  afterEach(() => vi.restoreAllMocks());
  it("redacts an authentication adapter outage at the public cancellation boundary", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "private-cleanup",
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: user.authUserId,
        recoveryGeneration: 0,
        userId: user.userId,
      });
    });
    const before = await t.query((ctx) =>
      ctx.db.query("accountDeletionPreparations").unique()
    );
    vi.spyOn(authReader, "getAnyUserById").mockRejectedValueOnce(
      new Error("private authentication adapter detail")
    );
    await expect(
      t.mutation(api.auth.deletion.cancelAccountDeletionAttempt, {
        attemptId: ATTEMPT_ID,
      })
    ).rejects.toHaveProperty("data", {
      _tag: "UserCleanupError",
      code: "USER_CLEANUP_FAILED",
      message: "Unable to complete account cleanup.",
    });
    expect(
      await t.query((ctx) =>
        ctx.db.query("accountDeletionPreparations").unique()
      )
    ).toEqual(before);
  });
  it("never reopens an irreversible deletion from the browser token", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "started-owner",
        credits: 0,
        creditsResetAt: 0,
        deletionPreparedAt: NOW,
        email: "started@example.com",
        mascot: MASCOT_CODE,
        name: "Started Owner",
        plan: "free",
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "started-owner",
        deletionStartedAt: NOW,
        recoveryGeneration: 1,
        userId: insertedUserId,
      });
      return insertedUserId;
    });
    const authUserExists = vi.fn(() => Effect.succeed(true));
    const canceled = await t.mutation((ctx) =>
      Effect.runPromise(
        cancelAccountDeletionAttemptByToken(ATTEMPT_ID, authUserExists).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", userId),
    }));
    expect(canceled).toBeNull();
    expect(authUserExists).not.toHaveBeenCalled();
    expect(state.preparation?.deletionStartedAt).toBe(NOW);
    expect(state.user?.deletionPreparedAt).toBe(NOW);
  });
  it("does not invent cancellation proof for an unknown attempt", async () => {
    const t = convexTest(schema, convexModules);
    const authUserExists = vi.fn(() => Effect.succeed(true));
    const outcome = await t.mutation((ctx) =>
      Effect.runPromise(
        cancelAccountDeletionAttemptByToken(ATTEMPT_ID, authUserExists).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(outcome).toBeNull();
    expect(authUserExists).not.toHaveBeenCalled();
    await t.mutation((ctx) =>
      Effect.runPromise(
        cancelAccountDeletionAttempt("missing-owner", ATTEMPT_ID).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    await expect(
      t.query((ctx) =>
        ctx.db.query("accountDeletionAttemptCancellations").collect()
      )
    ).resolves.toEqual([]);
  });
  it("treats a tombstoned attempt as completely canceled", async () => {
    const t = convexTest(schema, convexModules);
    const authUserExists = vi.fn(() => Effect.succeed(true));
    await t.mutation((ctx) =>
      ctx.db.insert("accountDeletionAttemptCancellations", {
        attemptId: ATTEMPT_ID,
        canceledAt: NOW,
      })
    );
    const outcome = await t.mutation((ctx) =>
      Effect.runPromise(
        cancelAccountDeletionAttemptByToken(ATTEMPT_ID, authUserExists).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(outcome).toBe(accountDeletionCancellationOutcome.complete);
    expect(authUserExists).not.toHaveBeenCalled();
  });
  it("does not cancel another browser attempt", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "attempt-owner",
        credits: 0,
        creditsResetAt: 0,
        deletionPreparedAt: NOW,
        email: "attempt@example.com",
        mascot: MASCOT_CODE,
        name: "Attempt Owner",
        plan: "free",
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "attempt-owner",
        recoveryGeneration: 0,
        userId: insertedUserId,
      });
      return insertedUserId;
    });
    await t.mutation((ctx) =>
      Effect.runPromise(
        cancelAccountDeletionAttempt(
          "attempt-owner",
          "019fa44c-02be-7cd0-a4ed-61a7af8e0621"
        ).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", userId),
    }));
    expect(state.preparation?.attemptId).toBe(ATTEMPT_ID);
    expect(state.user?.deletionPreparedAt).toBe(NOW);
  });
  it("cancels a browser-owned preparation completely in one call", async () => {
    const t = convexTest(schema, convexModules);
    const ownerId = await t.mutation(async (ctx) => {
      const insertedOwnerId = await ctx.db.insert("users", {
        authId: "batch-cancel-owner",
        credits: 0,
        creditsResetAt: 0,
        deletionPreparedAt: NOW,
        email: "batch-cancel-owner@example.com",
        mascot: MASCOT_CODE,
        name: "Batch Cancel Owner",
        plan: "free",
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "batch-cancel-owner",
        recoveryGeneration: 0,
        userId: insertedOwnerId,
      });
      return insertedOwnerId;
    });
    const authUserExists = vi.fn(() => Effect.succeed(true));
    const outcome = await t.mutation((ctx) =>
      Effect.runPromise(
        cancelAccountDeletionAttemptByToken(ATTEMPT_ID, authUserExists).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const replayedAttempt = await t.mutation((ctx) =>
      Effect.runPromise(
        claimAccountDeletion("batch-cancel-owner", ATTEMPT_ID).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const remaining = await t.query(async (ctx) => ({
      cancellations: await ctx.db
        .query("accountDeletionAttemptCancellations")
        .collect(),
      preparations: await ctx.db.query("accountDeletionPreparations").collect(),
      user: await ctx.db.get("users", ownerId),
    }));
    expect(outcome).toBe(accountDeletionCancellationOutcome.complete);
    expect(replayedAttempt).toBe(
      accountDeletionPreparationOutcome.temporarilyUnavailable
    );
    expect(authUserExists).toHaveBeenCalledOnce();
    expect(remaining.cancellations).toEqual([
      expect.objectContaining({
        attemptId: ATTEMPT_ID,
      }),
    ]);
    expect(remaining.preparations).toEqual([]);
    expect(remaining.user).not.toHaveProperty("deletionPreparedAt");
  });
});
