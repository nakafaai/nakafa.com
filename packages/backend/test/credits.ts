import { RegisteredConvexFunction } from "@confect/server";
import { assert } from "@effect/vitest";
import schema from "@repo/backend/confect/_generated/schema";
import usersTable from "@repo/backend/confect/_generated/tables/users";
import {
  refundCredits,
  reserveCredits,
} from "@repo/backend/confect/nina/credits/ledger";
import type { NinaCreditHold } from "@repo/backend/confect/nina/credits/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { runInMutation } from "@repo/backend/test/billing";
import { Effect, Schema } from "effect";

/** The moment the credit tests stand at: 1 September 2026, 00:00 UTC. */
export const CREDITS_NOW = Date.UTC(2026, 8, 1);

/** Reads a raw account the way Confect reads it, so its animal is decoded. */
const decodeUser = Schema.decodeUnknownSync(usersTable.Doc);

/**
 * One signed-in learner with `credits` in the period that resets at
 * `creditsResetAt`, and `reserve`, which holds credits for one Nina answer of
 * theirs the way an Agent turn does.
 */
export async function creditFixture(credits = 5, creditsResetAt = CREDITS_NOW) {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: CREDITS_NOW, credits, creditsResetAt })
  );
  const reserve = () =>
    t.mutation(async (ctx) => {
      const user = await ctx.db.get("users", identity.userId);
      assert(user);
      return Effect.runPromise(
        reserveCredits(decodeUser(user)).pipe(
          Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
        )
      );
    });
  return { t, identity, reserve };
}

/** Refunds part of one hold inside a test mutation, as settlement does. */
export async function refundHold(
  t: Awaited<ReturnType<typeof creditFixture>>["t"],
  hold: typeof NinaCreditHold.Type,
  reservationId: string,
  amount: number
) {
  await t.mutation((ctx) =>
    runInMutation(ctx, refundCredits(hold, reservationId, amount))
  );
}
