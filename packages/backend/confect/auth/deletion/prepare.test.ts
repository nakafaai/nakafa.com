import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { ACCOUNT_DELETION_RECOVERY_DELAY_MS } from "@repo/backend/confect/auth/deletion/constants";
import { prepareAccountDeletion } from "@repo/backend/confect/auth/deletion/prepare";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { seedDeletionUser } from "@repo/backend/test/deletion/seed";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 6, 28, 8, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";
function prepareInTest(
  ctx: MutationCtx,
  authId: string,
  attemptId = ATTEMPT_ID
) {
  return prepareAccountDeletion(authId, attemptId).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(confectSchema, ctx))
  );
}
describe("auth/deletion/prepare", () => {
  it("treats an account that does not exist as ready", async () => {
    const t = convexTest(schema, convexModules);
    const outcome = await t.mutation((ctx) =>
      Effect.runPromise(prepareInTest(ctx, "missing-auth-user"))
    );
    expect(outcome).toBe("ready");
  });
  it("rejects a delayed request after its attempt was canceled", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await seedDeletionUser(
        ctx,
        "canceled-attempt-owner"
      );
      await ctx.db.insert("accountDeletionAttemptCancellations", {
        attemptId: ATTEMPT_ID,
        canceledAt: NOW,
      });
      return insertedUserId;
    });
    const outcome = await t.mutation((ctx) =>
      Effect.runPromise(prepareInTest(ctx, "canceled-attempt-owner"))
    );
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", userId),
    }));
    expect(outcome).toBe("temporarily-unavailable");
    expect(state.preparation).toBeNull();
    expect(state.user).not.toHaveProperty("deletionPreparedAt");
  });
  it("prepares an account in one call and quiesces its writes", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      seedDeletionUser(ctx, "prepared-owner")
    );
    vi.setSystemTime(NOW);
    const outcome = await t.mutation((ctx) =>
      Effect.runPromise(prepareInTest(ctx, "prepared-owner"))
    );
    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", userId),
    }));
    expect(outcome).toBe("ready");
    expect(state.user?.deletionPreparedAt).toBe(NOW);
    expect(state.user).not.toHaveProperty("deletedAt");
    expect(state.preparation).toMatchObject({
      attemptId: ATTEMPT_ID,
      authId: "prepared-owner",
      readyAt: NOW,
      recoveryAt: NOW + ACCOUNT_DELETION_RECOVERY_DELAY_MS,
      recoveryGeneration: 1,
      userId,
    });
  });
  it("refreshes one preparation without duplicating it", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedDeletionUser(ctx, "retry-owner"));
    for (const now of [NOW, NOW + 1000]) {
      vi.setSystemTime(now);
      await t.mutation((ctx) =>
        Effect.runPromise(prepareInTest(ctx, "retry-owner"))
      );
    }
    const preparations = await t.query((ctx) =>
      ctx.db.query("accountDeletionPreparations").collect()
    );
    expect(preparations).toHaveLength(1);
    expect(preparations[0]?.attemptId).toBe(ATTEMPT_ID);
    expect(preparations[0]?.recoveryAt).toBe(
      NOW + 1000 + ACCOUNT_DELETION_RECOVERY_DELAY_MS
    );
    expect(preparations[0]?.recoveryGeneration).toBe(2);
  });
  it.each([false, true])(
    "rejects a conflicting or finalized browser attempt: %s",
    async (finalized) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) =>
        seedDeletionUser(ctx, "concurrent-attempt-owner")
      );
      await t.mutation((ctx) =>
        Effect.runPromise(prepareInTest(ctx, "concurrent-attempt-owner"))
      );
      const initialPreparation = await t.query((ctx) =>
        ctx.db.query("accountDeletionPreparations").unique()
      );
      if (finalized && initialPreparation) {
        await t.mutation((ctx) =>
          ctx.db.patch("accountDeletionPreparations", initialPreparation._id, {
            finalizedAt: NOW,
          })
        );
      }
      const outcome = await t.mutation((ctx) =>
        Effect.runPromise(
          prepareInTest(
            ctx,
            "concurrent-attempt-owner",
            "019fa44c-02be-7cd0-a4ed-61a7af8e0621"
          )
        )
      );
      const preparation = await t.query((ctx) =>
        ctx.db.query("accountDeletionPreparations").unique()
      );
      expect(outcome).toBe("temporarily-unavailable");
      expect(preparation?.attemptId).toBe(ATTEMPT_ID);
      expect(preparation?.recoveryGeneration).toBe(
        initialPreparation?.recoveryGeneration
      );
      expect(preparation?.recoveryAt).toBe(initialPreparation?.recoveryAt);
    }
  );
});
