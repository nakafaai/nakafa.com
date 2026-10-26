import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
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
  type DeletionSubscription,
} from "@repo/backend/confect/billing/deletion.spec";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import {
  BillingStateError,
  XenditDeactivateError,
  xenditDeactivateErrorCode,
} from "@repo/backend/confect/billing/spec";
import { ensurePlanInactive } from "@repo/backend/confect/billing/xendit/plans";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Array as Arr, Effect, flow, Layer } from "effect";

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

/** The failure of turning a Xendit plan off, so the deletion retries it. */
function xenditDeactivateFailure(cause: unknown) {
  return new XenditDeactivateError({
    code: xenditDeactivateErrorCode,
    cause,
    message: "Failed to turn off a Xendit recurring plan.",
  });
}

/** The personal billing account of the user on each rail that holds one. */
const personalAccounts = Effect.fn("billing.deletion.personalAccounts")(
  function* (userId: Docs["users"]["_id"]) {
    const found = yield* Effect.forEach(RAILS, (rail) =>
      findAccount({ kind: "personal", userId }, rail)
    );
    return Arr.getSomes(found);
  }
);

const readAccounts = FunctionImpl.make(
  databaseSchema,
  spec,
  "readAccounts",
  Effect.fn("billing.deletion.readAccounts")(function* (args) {
    const accounts = yield* personalAccounts(args.userId);
    return Arr.map(
      accounts,
      (account): DeletionAccount => ({
        accountId: account._id,
        rail: account.rail,
        providerCustomerId: account.providerCustomerId,
      })
    );
  })
);

/** The subscriptions of one batch of a deleted user's personal accounts, with each Xendit plan they bill through. */
const readSubscriptions = FunctionImpl.make(
  databaseSchema,
  spec,
  "readSubscriptions",
  Effect.fn("billing.deletion.readSubscriptions")(function* (args) {
    const reader = yield* DatabaseReader;
    const accounts = yield* personalAccounts(args.userId);
    const rows = yield* Effect.forEach(accounts, (account) =>
      reader
        .table("billingSubscriptions")
        .index("by_accountId_and_status", (query) =>
          query.eq("accountId", account._id)
        )
        .take(DELETION_BATCH)
        .pipe(Effect.orDie)
    );
    return Arr.map(
      Arr.take(Arr.flatten(rows), DELETION_BATCH),
      (row): DeletionSubscription => ({
        subscriptionId: row._id,
        xenditPlanId:
          row.provider.kind === "xendit" ? row.provider.planId : null,
      })
    );
  })
);

/**
 * Deletes one batch of a deleted user's billing rows: the grants, the top-up packs, the listed
 * subscriptions that belong to the user's accounts, one batch of payments and of checkouts,
 * and an account once it holds no subscription, payment or checkout. Only the listed
 * subscriptions are deleted, so a subscription that arrived after they were read is kept
 * until its Xendit plan is turned off. Returns whether rows remain.
 */
const deleteRows = FunctionImpl.make(
  databaseSchema,
  spec,
  "deleteRows",
  Effect.fn("billing.deletion.deleteRows")(function* (args) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
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
    let remaining = grants.length === DELETION_BATCH;
    // The top-up packs of a deleted learner go with the learner, before their payments do.
    const lots = yield* reader
      .table("creditLots")
      .index("by_userId_and_state_and_expiresAt", (query) =>
        query.eq("userId", args.userId)
      )
      .take(DELETION_BATCH)
      .pipe(Effect.orDie);
    for (const lot of lots) {
      yield* writer.table("creditLots").delete(lot._id).pipe(Effect.orDie);
    }
    remaining = remaining || lots.length === DELETION_BATCH;
    const accountIds = Arr.map(
      yield* personalAccounts(args.userId),
      (account) => account._id
    );
    for (const subscriptionId of args.subscriptionIds) {
      const subscription = yield* reader
        .table("billingSubscriptions")
        .get(subscriptionId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (
        subscription !== null &&
        Arr.contains(accountIds, subscription.accountId)
      ) {
        yield* writer
          .table("billingSubscriptions")
          .delete(subscription._id)
          .pipe(Effect.orDie);
      }
    }
    for (const accountId of accountIds) {
      const payments = yield* reader
        .table("billingPayments")
        .index("by_accountId_and_paidAt", (query) =>
          query.eq("accountId", accountId)
        )
        .take(DELETION_BATCH)
        .pipe(Effect.orDie);
      for (const payment of payments) {
        yield* writer
          .table("billingPayments")
          .delete(payment._id)
          .pipe(Effect.orDie);
      }
      const checkouts = yield* reader
        .table("billingCheckouts")
        .index("by_accountId_and_status", (query) =>
          query.eq("accountId", accountId)
        )
        .take(DELETION_BATCH)
        .pipe(Effect.orDie);
      for (const checkout of checkouts) {
        yield* writer
          .table("billingCheckouts")
          .delete(checkout._id)
          .pipe(Effect.orDie);
      }
      const subscriptions = yield* reader
        .table("billingSubscriptions")
        .index("by_accountId_and_status", (query) =>
          query.eq("accountId", accountId)
        )
        .take(1)
        .pipe(Effect.orDie);
      if (
        payments.length === DELETION_BATCH ||
        checkouts.length === DELETION_BATCH ||
        subscriptions.length > 0
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

/**
 * Erases the Polar customer of the user, then turns off the Xendit plans in each batch
 * before the batch's rows are deleted. A customer is looked up by the user's auth ID
 * when no account links one, so a customer Nakafa never stored is erased too.
 */
const cleanupDeletedUserBilling = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedUserBilling",
  Effect.fn("billing.deletion.cleanupDeletedUserBilling")(function* (args) {
    const { runQuery } = yield* QueryRunner;
    const { runMutation } = yield* MutationRunner;
    const accounts = yield* runQuery(
      refs.internal.billing.deletion.readAccounts,
      { userId: args.userId }
    ).pipe(
      Effect.mapError(billingStateError),
      Effect.catchDefect(flow(billingStateError, Effect.fail))
    );
    const linkedCustomerIds = Arr.flatMap(accounts, (account) =>
      account.rail === "polar" && account.providerCustomerId !== null
        ? [account.providerCustomerId]
        : []
    );
    if (linkedCustomerIds.length === 0) {
      const customer = yield* polarGateway.getCustomerByExternalId(args.authId);
      if (customer !== null) {
        yield* polarGateway.deleteCustomer(customer.id);
      }
    }
    for (const customerId of linkedCustomerIds) {
      yield* polarGateway.deleteCustomer(customerId);
    }
    let hasMore = true;
    while (hasMore) {
      const subscriptions = yield* runQuery(
        refs.internal.billing.deletion.readSubscriptions,
        { userId: args.userId }
      ).pipe(
        Effect.mapError(billingStateError),
        Effect.catchDefect(flow(billingStateError, Effect.fail))
      );
      for (const subscription of subscriptions) {
        if (subscription.xenditPlanId !== null) {
          yield* ensurePlanInactive(subscription.xenditPlanId).pipe(
            Effect.scoped,
            Effect.mapError(xenditDeactivateFailure)
          );
        }
      }
      hasMore = yield* runMutation(refs.internal.billing.deletion.deleteRows, {
        subscriptionIds: Arr.map(
          subscriptions,
          (subscription) => subscription.subscriptionId
        ),
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
  Layer.provide(readSubscriptions),
  Layer.provide(deleteRows),
  Layer.provide(cleanupDeletedUserBilling),
  Layer.provide(atomic),
  GroupImpl.finalize
);
