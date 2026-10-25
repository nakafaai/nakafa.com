import { Ref } from "@confect/core";
import { mutationLayer } from "@confect/server/RegisteredConvexFunction";

import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { finalizeAccountDeletion } from "@repo/backend/confect/auth/deletion/finalize";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  seedDeletionUser,
  seedPreparedDeletion,
} from "@repo/backend/test/deletion/seed";
import { convexTest } from "convex-test";
import { Array as Arr, Effect } from "effect";

const NOW = Date.UTC(2026, 6, 28, 10, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
const launchCleanupName = Ref.getConvexFunctionName(
  refs.internal.auth.deletion.workflow.launchDeletedUserCleanup
);
describe("auth/deletion/finalize", () => {
  afterEach(() => vi.useRealTimers());
  it("does not restart absent or already-running cleanup and repairs its missing receipt", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      Effect.runPromise(
        finalizeAccountDeletion("missing-user").pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    );
    const userId = await t.mutation(async (ctx) => {
      const id = await seedDeletionUser(ctx, "started-user");
      await ctx.db.patch("users", id, {
        deletionCleanupStartedAt: NOW,
      });
      return id;
    });
    await t.mutation((ctx) =>
      Effect.runPromise(
        finalizeAccountDeletion("started-user").pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    );
    await t.mutation((ctx) =>
      ctx.db.insert("accountDeletionPreparations", {
        authId: "started-user",
        userId,
        attemptId: ATTEMPT_ID,
        finalizedAt: NOW,
        recoveryGeneration: 0,
      })
    );
    await t.mutation((ctx) =>
      Effect.runPromise(
        finalizeAccountDeletion("started-user").pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    );
    expect(
      await t.query(async (ctx) =>
        Arr.filter(
          await ctx.db.system.query("_scheduled_functions").collect(),
          (job) => job.name === launchCleanupName
        )
      )
    ).toHaveLength(0);
    await expect(
      t.query((ctx) => ctx.db.query("accountDeletionReceipts").unique())
    ).resolves.toMatchObject({
      attemptId: ATTEMPT_ID,
      committedAt: NOW,
    });
  });
  it("rolls back anonymization when durable cleanup scheduling fails", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      seedDeletionUser(ctx, "scheduler-failure")
    );
    const before = await t.query((ctx) => ctx.db.get("users", userId));
    await expect(
      t.mutation((ctx) => {
        vi.spyOn(ctx.scheduler, "runAfter").mockRejectedValueOnce(
          new Error("scheduler offline")
        );
        return Effect.runPromise(
          finalizeAccountDeletion("scheduler-failure").pipe(
            Effect.provide(mutationLayer(confectSchema, ctx))
          )
        );
      })
    ).rejects.toMatchObject({
      code: "USER_CLEANUP_FAILED",
      message: "Unable to complete account cleanup.",
    });
    await expect(
      t.query((ctx) => ctx.db.get("users", userId))
    ).resolves.toEqual(before);
    await expect(
      t.query((ctx) => ctx.db.query("accountDeletionPreparations").collect())
    ).resolves.toEqual([]);
  });
  it("atomically finalizes the preparation, tombstones the user, and queues cleanup", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation((ctx) =>
      seedPreparedDeletion(ctx, "finalize-owner", NOW, ATTEMPT_ID)
    );
    await t.mutation((ctx) =>
      Effect.runPromise(
        finalizeAccountDeletion("finalize-owner", {
          attemptId: ATTEMPT_ID,
          preparationId: seeded.preparationId,
          recoveryGeneration: 0,
        }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
      )
    );
    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded.userId),
      preparation: await ctx.db.get(
        "accountDeletionPreparations",
        seeded.preparationId
      ),
      receipt: await ctx.db.query("accountDeletionReceipts").unique(),
    }));
    expect(state.owner?.deletedAt).toEqual(expect.any(Number));
    expect(state.owner).toMatchObject({
      authId: `deleted:${seeded.userId}`,
      credits: 0,
      creditsResetAt: 0,
      email: `deleted-${seeded.userId}@account.nakafa.invalid`,
      name: "Deleted user",
      plan: "free",
    });
    expect(state.owner).not.toHaveProperty("deletionPreparedAt");
    expect(state.owner).not.toHaveProperty("image");
    expect(state.owner).not.toHaveProperty("role");
    expect(state.preparation?.finalizedAt).toEqual(expect.any(Number));
    expect(state.preparation).not.toHaveProperty("recoveryAt");
    expect(state.receipt).toMatchObject({
      attemptId: ATTEMPT_ID,
      committedAt: expect.any(Number),
    });
    expect(
      await t.query(async (ctx) =>
        Arr.filter(
          await ctx.db.system.query("_scheduled_functions").collect(),
          (job) => job.name === launchCleanupName
        )
      )
    ).toContainEqual(
      expect.objectContaining({
        args: [
          {
            authId: "finalize-owner",
            userId: seeded.userId,
          },
        ],
        state: {
          kind: "pending",
        },
      })
    );
  });
  it("ignores recovery for a newer preparation", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation(async (ctx) => {
      const result = await seedPreparedDeletion(
        ctx,
        "newer-finalize-owner",
        NOW,
        ATTEMPT_ID
      );
      await ctx.db.patch("accountDeletionPreparations", result.preparationId, {
        recoveryGeneration: 1,
      });
      await ctx.db.patch("users", result.userId, {
        deletionPreparedAt: NOW + 1,
      });
      return result;
    });
    await t.mutation((ctx) =>
      Effect.runPromise(
        finalizeAccountDeletion("newer-finalize-owner", {
          attemptId: ATTEMPT_ID,
          preparationId: seeded.preparationId,
          recoveryGeneration: 0,
        }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
      )
    );
    const owner = await t.query((ctx) => ctx.db.get("users", seeded.userId));
    expect(owner?.deletionPreparedAt).toBe(NOW + 1);
    expect(owner).not.toHaveProperty("deletedAt");
    expect(
      await t.query(async (ctx) =>
        Arr.filter(
          await ctx.db.system.query("_scheduled_functions").collect(),
          (job) => job.name === launchCleanupName
        )
      )
    ).toHaveLength(0);
  });
  it("requeues cleanup from the finalized journal after profile anonymization", async () => {
    const t = convexTest(schema, convexModules);
    const seeded = await t.mutation((ctx) =>
      seedPreparedDeletion(ctx, "requeue-finalize-owner", NOW, ATTEMPT_ID)
    );
    await t.mutation((ctx) =>
      Effect.runPromise(
        finalizeAccountDeletion("requeue-finalize-owner", {
          attemptId: ATTEMPT_ID,
          preparationId: seeded.preparationId,
          recoveryGeneration: 0,
        }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
      )
    );
    await t.mutation((ctx) =>
      Effect.runPromise(
        finalizeAccountDeletion("requeue-finalize-owner").pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    );
    expect(
      await t.query(async (ctx) =>
        Arr.filter(
          await ctx.db.system.query("_scheduled_functions").collect(),
          (job) => job.name === launchCleanupName
        )
      )
    ).toContainEqual(
      expect.objectContaining({
        args: [
          {
            authId: "requeue-finalize-owner",
            userId: seeded.userId,
          },
        ],
        state: {
          kind: "pending",
        },
      })
    );
  });
  it("journals direct auth removals without a preparation", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      seedDeletionUser(ctx, "direct-auth-removal")
    );
    await t.mutation((ctx) =>
      Effect.runPromise(
        finalizeAccountDeletion("direct-auth-removal").pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    );
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      receipt: await ctx.db.query("accountDeletionReceipts").unique(),
      user: await ctx.db.get("users", userId),
    }));
    expect(state.user?.deletedAt).toEqual(expect.any(Number));
    expect(state.user).toMatchObject({
      authId: `deleted:${userId}`,
      email: `deleted-${userId}@account.nakafa.invalid`,
      name: "Deleted user",
    });
    expect(state.preparation).toMatchObject({
      authId: "direct-auth-removal",
      finalizedAt: expect.any(Number),
      userId,
    });
    expect(state.receipt).toBeNull();
    expect(
      await t.query(async (ctx) =>
        Arr.filter(
          await ctx.db.system.query("_scheduled_functions").collect(),
          (job) => job.name === launchCleanupName
        )
      )
    ).toContainEqual(
      expect.objectContaining({
        args: [
          {
            authId: "direct-auth-removal",
            userId,
          },
        ],
        state: {
          kind: "pending",
        },
      })
    );
  });
});
