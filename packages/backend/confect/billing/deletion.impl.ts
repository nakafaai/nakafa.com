import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { findAccount } from "@repo/backend/confect/billing/accounts";
import spec, {
  type DeletionAccount,
} from "@repo/backend/confect/billing/deletion.spec";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import { BillingStateError } from "@repo/backend/confect/billing/spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Array as Arr, Effect, flow, Layer, Option } from "effect";

/** Rows one deletion batch reads per table, so a batch never reads an unbounded set. */
const DELETION_BATCH = 100;

const RAILS = ["polar", "xendit"] as const;

/** The failure of a billing read or write during deletion, as the typed billing error. */
function billingStateError() {
  return new BillingStateError({
    code: "BILLING_STATE_FAILED",
    message: "Unable to read or update billing state.",
  });
}

const readAccounts = FunctionImpl.make(
  databaseSchema,
  spec,
  "readAccounts",
  Effect.fn("billing.deletion.readAccounts")(function* (args) {
    const found = yield* Effect.forEach(RAILS, (rail) =>
      Effect.map(
        findAccount({ kind: "personal", userId: args.userId }, rail),
        Option.map(
          (account): DeletionAccount => ({
            accountId: account._id,
            rail,
            providerCustomerId: account.providerCustomerId,
          })
        )
      )
    );
    return Arr.getSomes(found);
  })
);

const deleteRows = FunctionImpl.make(
  databaseSchema,
  spec,
  "deleteRows",
  Effect.fn("billing.deletion.deleteRows")(function* (args) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    let remaining = false;
    const grants = yield* reader
      .table("billingGrants")
      .index("by_userId_and_validTo", (query) =>
        query.eq("userId", args.userId)
      )
      .take(DELETION_BATCH)
      .pipe(Effect.orDie);
    for (const grant of grants) {
      yield* writer.table("billingGrants").delete(grant._id).pipe(Effect.orDie);
    }
    remaining = grants.length === DELETION_BATCH;
    for (const rail of RAILS) {
      const account = yield* findAccount(
        { kind: "personal", userId: args.userId },
        rail
      );
      if (Option.isNone(account)) {
        continue;
      }
      const accountId = account.value._id;
      const subscriptions = yield* reader
        .table("billingSubscriptions")
        .index("by_accountId_and_status", (query) =>
          query.eq("accountId", accountId)
        )
        .take(DELETION_BATCH)
        .pipe(Effect.orDie);
      const payments = yield* reader
        .table("billingPayments")
        .index("by_accountId_and_paidAt", (query) =>
          query.eq("accountId", accountId)
        )
        .take(DELETION_BATCH)
        .pipe(Effect.orDie);
      for (const subscription of subscriptions) {
        yield* writer
          .table("billingSubscriptions")
          .delete(subscription._id)
          .pipe(Effect.orDie);
      }
      for (const payment of payments) {
        yield* writer
          .table("billingPayments")
          .delete(payment._id)
          .pipe(Effect.orDie);
      }
      if (
        subscriptions.length === DELETION_BATCH ||
        payments.length === DELETION_BATCH
      ) {
        remaining = true;
        continue;
      }
      yield* writer
        .table("billingAccounts")
        .delete(accountId)
        .pipe(Effect.orDie);
    }
    return remaining;
  })
);

const cleanupDeletedUserBilling = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedUserBilling",
  Effect.fn("billing.deletion.cleanupDeletedUserBilling")(function* (args) {
    const { runQuery } = yield* QueryRunner;
    const { runMutation } = yield* MutationRunner;
    const accounts = yield* runQuery(
      refs.internal.billing.deletion.readAccounts,
      {
        userId: args.userId,
      }
    ).pipe(
      Effect.mapError(billingStateError),
      Effect.catchDefect(flow(billingStateError, Effect.fail))
    );
    for (const account of accounts) {
      if (account.rail === "polar" && account.providerCustomerId !== null) {
        yield* polarGateway.deleteCustomer(account.providerCustomerId);
      }
    }
    let hasMore = true;
    while (hasMore) {
      hasMore = yield* runMutation(refs.internal.billing.deletion.deleteRows, {
        userId: args.userId,
      }).pipe(
        Effect.mapError(billingStateError),
        Effect.catchDefect(flow(billingStateError, Effect.fail))
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(readAccounts),
  Layer.provide(deleteRows),
  Layer.provide(cleanupDeletedUserBilling),
  Layer.provide(atomic),
  GroupImpl.finalize
);
