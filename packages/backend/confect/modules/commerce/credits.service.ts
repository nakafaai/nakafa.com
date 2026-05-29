import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  getCurrentCreditResetTimestamp,
  getEffectiveCreditStateForResetTimestamp,
} from "@repo/backend/confect/modules/commerce/credits.policy";
import type { UserPlan } from "@repo/backend/confect/modules/identity/users.tables";
import { Clock, Effect } from "effect";

/** Synchronizes a single plan's credit reset period with the current clock. */
export const syncCreditResetPeriod = Effect.fnUntraced(function* (args: {
  plan: UserPlan;
}) {
  const now = yield* Clock.currentTimeMillis;

  yield* upsertCreditResetPeriod({
    plan: args.plan,
    resetAt: getCurrentCreditResetTimestamp(args.plan, now),
  });

  return null;
});

/** Synchronizes all credit reset periods with the current clock. */
export const syncAllCreditResetPeriods = Effect.fnUntraced(function* () {
  const now = yield* Clock.currentTimeMillis;

  yield* upsertCreditResetPeriod({
    plan: "free",
    resetAt: getCurrentCreditResetTimestamp("free", now),
  });
  yield* upsertCreditResetPeriod({
    plan: "pro",
    resetAt: getCurrentCreditResetTimestamp("pro", now),
  });

  return null;
});

/** Resolves the persisted reset timestamp that should apply to a plan. */
export const resolveCreditResetTimestamp = Effect.fnUntraced(function* (args: {
  now: number;
  plan: UserPlan;
}) {
  const reader = yield* DatabaseReader;
  const currentResetTimestamp = getCurrentCreditResetTimestamp(
    args.plan,
    args.now
  );
  const storedPeriod = yield* reader
    .table("creditResetPeriods")
    .get("by_plan", args.plan)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (storedPeriod !== null && storedPeriod.resetAt >= currentResetTimestamp) {
    return storedPeriod.resetAt;
  }

  yield* upsertCreditResetPeriod({
    plan: args.plan,
    resetAt: currentResetTimestamp,
  });

  return currentResetTimestamp;
});

/** Resolves a user's effective credits through Confect database services. */
export const resolveUserCreditState = Effect.fnUntraced(function* (args: {
  now: number;
  user: Doc<"users">;
}) {
  const resetTimestamp = yield* resolveCreditResetTimestamp({
    now: args.now,
    plan: args.user.plan,
  });

  return getEffectiveCreditStateForResetTimestamp(args.user, resetTimestamp);
});

/** Upserts the persisted reset timestamp for a plan through Confect services. */
const upsertCreditResetPeriod = Effect.fnUntraced(function* (args: {
  plan: UserPlan;
  resetAt: number;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existingPeriod = yield* reader
    .table("creditResetPeriods")
    .get("by_plan", args.plan)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (!existingPeriod) {
    yield* writer.table("creditResetPeriods").insert({
      plan: args.plan,
      resetAt: args.resetAt,
    });
    return null;
  }

  if (existingPeriod.resetAt === args.resetAt) {
    return null;
  }

  yield* writer.table("creditResetPeriods").patch(existingPeriod._id, {
    resetAt: args.resetAt,
  });

  return null;
});
