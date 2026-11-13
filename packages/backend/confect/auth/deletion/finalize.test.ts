import { Ref } from "@confect/core";
import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { finalizeAccountDeletion } from "@repo/backend/confect/auth/deletion/finalize";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  seedAccountAgents,
  seedDeletionUser,
} from "@repo/backend/test/deletion/seed";
import { convexTest, type TestConvex } from "convex-test";
import { Array as Arr, Effect } from "effect";

const NOW = Date.UTC(2026, 6, 28, 10, 0, 0);
const finalizeName = Ref.getConvexFunctionName(
  refs.internal.auth.deletion.workflow.finalize
);
const launchName = Ref.getConvexFunctionName(
  refs.internal.auth.deletion.workflow.launch
);

/** Runs one finalize step in its own transaction, as the scheduled function does. */
function finalize(t: TestConvex<typeof schema>, userId: Id<"users">) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      finalizeAccountDeletion(userId).pipe(
        Effect.provide(mutationLayer(confectSchema, ctx))
      )
    )
  );
}

/** The arguments of each pending job of one function, oldest first. */
function pendingJobs(t: TestConvex<typeof schema>, name: string) {
  return t.query(async (ctx) =>
    Arr.map(
      Arr.filter(
        await ctx.db.system.query("_scheduled_functions").collect(),
        (job) => job.name === name && job.state.kind === "pending"
      ),
      (job) => job.args
    )
  );
}

/** Every grant and unspent code that an account's agents still hold. */
function agentRows(ctx: MutationCtx, userId: Id<"users">) {
  return Promise.all([
    ctx.db
      .query("agentGrants")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .collect(),
    ctx.db
      .query("agentCodes")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .collect(),
  ]);
}

describe("auth/deletion/finalize", () => {
  afterEach(() => vi.useRealTimers());

  it("leaves an account that is gone, live, or already cleaning up as it is", async () => {
    const t = convexTest(schema, convexModules);
    const gone = await t.mutation(async (ctx) => {
      const id = await seedDeletionUser(ctx, "gone");
      await ctx.db.delete("users", id);
      return id;
    });
    const live = await t.mutation((ctx) => seedDeletionUser(ctx, "live"));
    const started = await t.mutation((ctx) =>
      seedDeletionUser(ctx, "started", {
        deletedAt: NOW,
        deletionCleanupStartedAt: NOW,
      })
    );
    const before = await t.query(async (ctx) => [
      await ctx.db.get("users", live),
      await ctx.db.get("users", started),
    ]);
    for (const userId of [gone, live, started]) {
      await finalize(t, userId);
    }
    await expect(
      t.query(async (ctx) => [
        await ctx.db.get("users", live),
        await ctx.db.get("users", started),
      ])
    ).resolves.toEqual(before);
    await expect(pendingJobs(t, launchName)).resolves.toEqual([]);
    await expect(pendingJobs(t, finalizeName)).resolves.toEqual([]);
  });

  it("deletes the account's agents, writes the tombstone and starts the cleanup", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const id = await seedDeletionUser(ctx, "finalize-owner", {
        deletedAt: NOW,
      });
      await ctx.db.patch("users", id, {
        bio: "Suka matematika.",
        image: "https://example.com/owner.png",
        role: "teacher",
        username: "finalize-owner",
      });
      await seedAccountAgents(ctx, id, 2, NOW);
      return id;
    });
    await finalize(t, userId);
    const owner = await t.query((ctx) => ctx.db.get("users", userId));
    expect(owner).toMatchObject({
      credits: 0,
      creditsResetAt: 0,
      deletedAt: NOW,
      email: `deleted-${userId}@account.nakafa.invalid`,
      name: "Deleted user",
      plan: "free",
    });
    for (const field of ["bio", "image", "role", "username"]) {
      expect(owner).not.toHaveProperty(field);
    }
    await expect(
      t.mutation((ctx) => agentRows(ctx, userId))
    ).resolves.toEqual([[], []]);
    await expect(pendingJobs(t, launchName)).resolves.toEqual([[{ userId }]]);
    await expect(pendingJobs(t, finalizeName)).resolves.toEqual([]);
  });

  it("deletes a full page of agents per transaction and asks again before the tombstone", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const id = await seedDeletionUser(ctx, "many-agents", {
        deletedAt: NOW,
      });
      await seedAccountAgents(
        ctx,
        id,
        ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1,
        NOW
      );
      return id;
    });
    await finalize(t, userId);
    const [grants, codes] = await t.mutation((ctx) => agentRows(ctx, userId));
    expect(grants).toHaveLength(1);
    expect(codes).toHaveLength(1);
    await expect(
      t.query((ctx) => ctx.db.get("users", userId))
    ).resolves.toMatchObject({ email: "many-agents@example.com" });
    await expect(pendingJobs(t, finalizeName)).resolves.toEqual([
      [{ userId }],
    ]);
    await expect(pendingJobs(t, launchName)).resolves.toEqual([]);
    await finalize(t, userId);
    await expect(
      t.mutation((ctx) => agentRows(ctx, userId))
    ).resolves.toEqual([[], []]);
    await expect(pendingJobs(t, launchName)).resolves.toEqual([[{ userId }]]);
  });

  it("rolls the tombstone back when the cleanup cannot be scheduled", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      seedDeletionUser(ctx, "scheduler-failure", { deletedAt: NOW })
    );
    const before = await t.query((ctx) => ctx.db.get("users", userId));
    await expect(
      t.mutation((ctx) => {
        vi.spyOn(ctx.scheduler, "runAfter").mockRejectedValueOnce(
          new Error("scheduler offline")
        );
        return Effect.runPromise(
          finalizeAccountDeletion(userId).pipe(
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
  });
});
