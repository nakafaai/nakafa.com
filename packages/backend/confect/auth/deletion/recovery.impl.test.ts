import { expect, it } from "@effect/vitest";
import {
  ACCOUNT_DELETION_RECONCILIATION_DELAY_MS,
  ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE,
} from "@repo/backend/confect/auth/deletion/constants";
import { authReader } from "@repo/backend/confect/auth/reader";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 8, 1);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

it.each([true, false])(
  "recovers an interrupted deletion with auth present=%s",
  async (authPresent) => {
    vi.setSystemTime(NOW);
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const other = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "retained-recovery",
      });
      const owner = authPresent
        ? await seedAuthenticatedUser(ctx, {
            now: NOW,
            suffix: "recovering-owner",
          })
        : {
            authUserId: "deleted-auth-user",
            userId: await ctx.db.insert("users", {
              authId: "deleted-auth-user",
              name: "Deleted account",
              email: "deleted@example.com",
              plan: "free",
              credits: 0,
              creditsResetAt: 0,
            }),
          };
      await ctx.db.patch("users", owner.userId, { deletionPreparedAt: NOW });
      const preparationId = await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: owner.authUserId,
        userId: owner.userId,
        recoveryGeneration: 1,
        recoveryAt: NOW,
      });
      return {
        owner,
        other: await ctx.db.get("users", other.userId),
        otherId: other.userId,
        preparationId,
      };
    });
    await t.action(internal.auth.deletion.recovery.recoverAccountDeletion, {
      authId: seeded.owner.authUserId,
      expectedPreparation: {
        attemptId: ATTEMPT_ID,
        preparationId: seeded.preparationId,
        recoveryGeneration: 1,
      },
    });
    const state = await t.query(async (ctx) => ({
      user: await ctx.db.get("users", seeded.owner.userId),
      preparation: await ctx.db.get(
        "accountDeletionPreparations",
        seeded.preparationId
      ),
      cancellations: await ctx.db
        .query("accountDeletionAttemptCancellations")
        .collect(),
      receipts: await ctx.db.query("accountDeletionReceipts").collect(),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
      auth: await authReader.getAnyUserById(ctx, seeded.owner.authUserId),
      other: await ctx.db.get("users", seeded.otherId),
    }));
    expect(state.other).toEqual(seeded.other);
    expect(state.user).not.toHaveProperty("deletionPreparedAt");
    if (authPresent) {
      expect(state.preparation).toBeNull();
      expect(state.cancellations).toMatchObject([
        { attemptId: ATTEMPT_ID, canceledAt: NOW },
      ]);
      expect(state.receipts).toEqual([]);
      expect(state.auth).not.toBeNull();
      expect(state.user).toMatchObject({
        authId: seeded.owner.authUserId,
        name: "User recovering-owner",
      });
      expect(state.scheduled).toEqual([]);
      return;
    }
    expect(state.auth).toBeNull();
    expect(state.cancellations).toEqual([]);
    expect(state.receipts).toMatchObject([
      { attemptId: ATTEMPT_ID, committedAt: NOW },
    ]);
    expect(state.preparation).toMatchObject({ finalizedAt: NOW });
    expect(state.preparation).not.toHaveProperty("recoveryAt");
    expect(state.user).toMatchObject({
      authId: `deleted:${seeded.owner.userId}`,
      name: "Deleted user",
      deletedAt: NOW,
    });
    expect(state.scheduled).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "customers/deletion/workflow:launchDeletedUserCleanup",
          scheduledTime: NOW,
          state: { kind: "pending" },
        }),
        expect.objectContaining({
          name: "customers/deletion/workflow:finalizeDeletedUserCleanup",
          scheduledTime: NOW + ACCOUNT_DELETION_RECONCILIATION_DELAY_MS,
          state: { kind: "pending" },
        }),
      ])
    );
    expect(state.scheduled).toHaveLength(2);
  }
);

it("claims one due recovery batch and schedules exactly one continuation", async () => {
  vi.setSystemTime(NOW);
  const t = createConvexTestWithBetterAuth();
  const preparations = await t.mutation(async (ctx) => {
    const owner = await seedAuthenticatedUser(ctx, {
      now: NOW,
      suffix: "swept-owner",
    });
    return await Promise.all(
      Array.from(
        { length: ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE },
        (_, index) =>
          ctx.db.insert("accountDeletionPreparations", {
            attemptId: ATTEMPT_ID,
            authId: `recover-${index}`,
            userId: owner.userId,
            recoveryGeneration: 0,
            recoveryAt: NOW - 1,
          })
      )
    );
  });
  await t.mutation(
    internal.auth.deletion.recovery.sweepAccountDeletionRecovery,
    {}
  );
  const state = await t.query(async (ctx) => ({
    rows: await Promise.all(
      Arr.map(preparations, (id) =>
        ctx.db.get("accountDeletionPreparations", id)
      )
    ),
    jobs: await ctx.db.system.query("_scheduled_functions").collect(),
  }));
  expect(state.rows).toEqual(
    Array.from({ length: ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE }, () =>
      expect.objectContaining({
        recoveryGeneration: 1,
        recoveryAt: NOW + ACCOUNT_DELETION_RECONCILIATION_DELAY_MS,
      })
    )
  );
  const recoveries = Arr.filter(
    state.jobs,
    (job) => job.name === "auth/deletion/recovery:recoverAccountDeletion"
  );
  expect(recoveries).toHaveLength(ACCOUNT_DELETION_RECOVERY_SWEEP_BATCH_SIZE);
  expect(Arr.map(recoveries, (job) => job.args)).toEqual(
    expect.arrayContaining(
      Arr.map(preparations, (preparationId, index) => [
        {
          authId: `recover-${index}`,
          expectedPreparation: {
            attemptId: ATTEMPT_ID,
            preparationId,
            recoveryGeneration: 1,
          },
        },
      ])
    )
  );
  expect(
    Arr.filter(
      state.jobs,
      (job) =>
        job.name === "auth/deletion/recovery:sweepAccountDeletionRecovery"
    )
  ).toHaveLength(1);
  await t.mutation(
    internal.auth.deletion.recovery.sweepAccountDeletionRecovery,
    {}
  );
  expect(
    await t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
  ).toEqual(state.jobs);
});
