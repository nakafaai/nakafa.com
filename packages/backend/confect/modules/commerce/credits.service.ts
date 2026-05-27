import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  getCurrentCreditResetTimestamp,
  upsertStoredCreditResetTimestamp,
} from "@repo/backend/confect/modules/commerce/credits.policy";
import type { UserPlan } from "@repo/backend/confect/modules/identity/users.tables";
import { Clock, Effect } from "effect";

/** Synchronizes a single plan's credit reset period with the current clock. */
export const syncCreditResetPeriod = Effect.fn(
  "commerce.syncCreditResetPeriod"
)(function* (args: { plan: UserPlan }) {
  const ctx = yield* MutationCtx;
  const now = yield* Clock.currentTimeMillis;

  yield* Effect.promise(() =>
    upsertStoredCreditResetTimestamp(
      ctx.db,
      args.plan,
      getCurrentCreditResetTimestamp(args.plan, now)
    )
  );

  return null;
});

/** Synchronizes all credit reset periods with the current clock. */
export const syncAllCreditResetPeriods = Effect.fn(
  "commerce.syncAllCreditResetPeriods"
)(function* () {
  const ctx = yield* MutationCtx;
  const now = yield* Clock.currentTimeMillis;

  yield* Effect.promise(() =>
    upsertStoredCreditResetTimestamp(
      ctx.db,
      "free",
      getCurrentCreditResetTimestamp("free", now)
    )
  );
  yield* Effect.promise(() =>
    upsertStoredCreditResetTimestamp(
      ctx.db,
      "pro",
      getCurrentCreditResetTimestamp("pro", now)
    )
  );

  return null;
});
