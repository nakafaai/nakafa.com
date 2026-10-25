import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { findAccount } from "@repo/backend/confect/billing/accounts";
import spec from "@repo/backend/confect/billing/queries.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer, Option } from "effect";

/**
 * Whether the viewer holds an active subscription on a personal account, on any
 * rail. Only a personal account buys Pro, so a school account never answers here.
 */
const hasActiveSubscription = FunctionImpl.make(
  databaseSchema,
  spec,
  "hasActiveSubscription",
  Effect.fn("billing.queries.hasActiveSubscription")(function* () {
    const { appUser } = yield* requireAuth();
    const reader = yield* DatabaseReader;
    const owner = { kind: "personal" as const, userId: appUser._id };
    const accounts = yield* Effect.all([
      findAccount(owner, "polar"),
      findAccount(owner, "xendit"),
    ]);
    for (const account of accounts) {
      if (Option.isNone(account)) {
        continue;
      }
      const subscription = yield* reader
        .table("billingSubscriptions")
        .index("by_accountId_and_status", (query) =>
          query.eq("accountId", account.value._id).eq("status", "active")
        )
        .first()
        .pipe(Effect.orDie);
      if (Option.isSome(subscription)) {
        return true;
      }
    }
    return false;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(hasActiveSubscription),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
