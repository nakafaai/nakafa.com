import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { cancelAccountDeletionAttemptByToken } from "@repo/backend/confect/auth/deletion/attemptCancellation";
import {
  cancelAccountDeletion,
  cleanupFinalizedAccountDeletion,
  sweepAccountDeletionCancellationsProgram,
} from "@repo/backend/confect/auth/deletion/cancel";
import { ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { seedPreparedDeletion } from "@repo/backend/test/deletion/seed";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 6, 28, 9, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
describe("auth/deletion/cancel", () => {
  it("restores access, removes the preparation, and records the cancellation", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation((ctx) =>
      seedPreparedDeletion(ctx, "cancel-owner", NOW, ATTEMPT_ID)
    );
    await t.mutation((ctx) =>
      Effect.runPromise(
        cancelAccountDeletion("cancel-owner", {
          attemptId: ATTEMPT_ID,
          preparationId: seeded.preparationId,
          recoveryGeneration: 0,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      cancellations: await ctx.db
        .query("accountDeletionAttemptCancellations")
        .collect(),
      owner: await ctx.db.get("users", seeded.userId),
      preparations: await ctx.db.query("accountDeletionPreparations").collect(),
    }));
    expect(state.owner).not.toHaveProperty("deletionPreparedAt");
    expect(state.owner).not.toHaveProperty("deletedAt");
    expect(state.preparations).toHaveLength(0);
    expect(state.cancellations).toEqual([
      expect.objectContaining({ attemptId: ATTEMPT_ID }),
    ]);
  });
  it("leaves a newer preparation untouched", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "newer-owner",
        credits: 0,
        creditsResetAt: 0,
        deletionPreparedAt: NOW + 1,
        email: "newer@example.com",
        mascot: MASCOT_CODE,
        name: "Newer Owner",
        plan: "free",
      });
      const preparationId = await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "newer-owner",
        recoveryGeneration: 1,
        userId: insertedUserId,
      });
      return {
        preparationId,
        userId: insertedUserId,
      };
    });
    await t.mutation((ctx) =>
      Effect.runPromise(
        cancelAccountDeletion("newer-owner", {
          attemptId: ATTEMPT_ID,
          preparationId: seeded.preparationId,
          recoveryGeneration: 0,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", seeded.userId),
    }));
    expect(state.preparation?.recoveryGeneration).toBe(1);
    expect(state.user?.deletionPreparedAt).toBe(NOW + 1);
  });
  it("never cancels a finalized account", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "finalized-owner",
        credits: 0,
        creditsResetAt: 0,
        deletedAt: NOW,
        email: "finalized@example.com",
        mascot: MASCOT_CODE,
        name: "Finalized Owner",
        plan: "free",
      });
      const preparationId = await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "finalized-owner",
        finalizedAt: NOW,
        recoveryGeneration: 0,
        userId: insertedUserId,
      });
      return {
        preparationId,
        userId: insertedUserId,
      };
    });
    await t.mutation((ctx) =>
      Effect.runPromise(
        cancelAccountDeletion("finalized-owner", {
          attemptId: ATTEMPT_ID,
          preparationId: seeded.preparationId,
          recoveryGeneration: 0,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", seeded.userId),
    }));
    expect(state.preparation?.finalizedAt).toBe(NOW);
    expect(state.user?.deletedAt).toBe(NOW);
  });
  it("removes finalized metadata after workflow admission", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "cleanup-owner",
        credits: 0,
        creditsResetAt: 0,
        deletedAt: NOW,
        deletionCleanupStartedAt: NOW,
        email: "cleanup@example.com",
        mascot: MASCOT_CODE,
        name: "Cleanup Owner",
        plan: "free",
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "cleanup-owner",
        finalizedAt: NOW,
        recoveryGeneration: 0,
        userId: insertedUserId,
      });
      return insertedUserId;
    });
    const removed = await t.mutation((ctx) =>
      Effect.runPromise(
        cleanupFinalizedAccountDeletion(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const preparationCount = await t.query(
      async (ctx) =>
        (await ctx.db.query("accountDeletionPreparations").collect()).length
    );
    expect(removed).toBe(true);
    expect(preparationCount).toBe(0);
  });
  it("reports nothing to remove when no preparation is left", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "no-preparation-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "no-preparation@example.com",
        mascot: MASCOT_CODE,
        name: "No Preparation Owner",
        plan: "free",
      })
    );
    const removed = await t.mutation((ctx) =>
      Effect.runPromise(
        cleanupFinalizedAccountDeletion(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(removed).toBe(false);
  });
  it("does not let a stale cancellation delete a retried preparation", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation((ctx) =>
      seedPreparedDeletion(ctx, "retry-owner", NOW, ATTEMPT_ID)
    );
    await t.mutation((ctx) =>
      Effect.runPromise(
        cancelAccountDeletionAttemptByToken(ATTEMPT_ID, () =>
          Effect.succeed(true)
        ).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    const retriedPreparationId = await t.mutation(async (ctx) => {
      await ctx.db.patch("users", seeded.userId, {
        deletionPreparedAt: NOW + 1,
      });
      return await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: "retry-owner",
        recoveryGeneration: 0,
        userId: seeded.userId,
      });
    });
    const canceled = await t.mutation(
      internal.auth.deletion.cancelAccountDeletion,
      {
        authId: "retry-owner",
        expectedPreparation: {
          attemptId: ATTEMPT_ID,
          preparationId: seeded.preparationId,
          recoveryGeneration: 0,
        },
      }
    );
    const remaining = await t.query(async (ctx) => ({
      preparation: await ctx.db.get(
        "accountDeletionPreparations",
        retriedPreparationId
      ),
      user: await ctx.db.get("users", seeded.userId),
    }));
    expect(canceled).toBeNull();
    expect(remaining.preparation?._id).toBe(retriedPreparationId);
    expect(remaining.user?.deletionPreparedAt).toBe(NOW + 1);
  });
  it("deletes expired cancellation tombstones in bounded pages", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (
        let index = 0;
        index <= ACCOUNT_DELETION_ATTEMPT_SWEEP_BATCH_SIZE;
        index += 1
      ) {
        await ctx.db.insert("accountDeletionAttemptCancellations", {
          attemptId: `expired-${index}`,
          canceledAt: 0,
        });
      }
      await ctx.db.insert("accountDeletionAttemptCancellations", {
        attemptId: "future",
        canceledAt: Number.MAX_SAFE_INTEGER,
      });
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          sweepAccountDeletionCancellationsProgram().pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toBe(true);
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          sweepAccountDeletionCancellationsProgram().pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toBe(false);
    const cancellations = await t.query((ctx) =>
      ctx.db.query("accountDeletionAttemptCancellations").collect()
    );
    expect(cancellations).toEqual([
      expect.objectContaining({
        attemptId: "future",
      }),
    ]);
  });
  it.each(["missing", "unlocked"])(
    "cancels a preparation for a %s user idempotently",
    async (state) => {
      const t = convexTest(schema, convexModules);
      const seeded = await t.mutation(async (ctx) => {
        const result = await seedPreparedDeletion(
          ctx,
          "detached-owner",
          NOW,
          ATTEMPT_ID
        );
        if (state === "missing") {
          await ctx.db.delete("users", result.userId);
        } else {
          await ctx.db.patch("users", result.userId, {
            deletionPreparedAt: undefined,
          });
        }
        await ctx.db.insert("accountDeletionAttemptCancellations", {
          attemptId: ATTEMPT_ID,
          canceledAt: NOW,
        });
        return result;
      });
      const args = {
        authId: "detached-owner",
        expectedPreparation: {
          attemptId: ATTEMPT_ID,
          preparationId: seeded.preparationId,
          recoveryGeneration: 0,
        },
      };
      await expect(
        t.mutation(internal.auth.deletion.cancelAccountDeletion, args)
      ).resolves.toBeNull();
      await expect(
        t.mutation(internal.auth.deletion.cancelAccountDeletion, args)
      ).resolves.toBeNull();
      await expect(
        t.query((ctx) => ctx.db.query("accountDeletionPreparations").collect())
      ).resolves.toEqual([]);
      await expect(
        t.query((ctx) =>
          ctx.db.query("accountDeletionAttemptCancellations").collect()
        )
      ).resolves.toEqual([
        expect.objectContaining({
          attemptId: ATTEMPT_ID,
          canceledAt: NOW,
        }),
      ]);
    }
  );
});
