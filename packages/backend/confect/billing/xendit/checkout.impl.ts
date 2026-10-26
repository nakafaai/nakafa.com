import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  accountUnavailableCode,
  accountUnavailableMessage,
} from "@repo/backend/confect/auth/spec";
import { ensureAccount } from "@repo/backend/confect/billing/accounts";
import { CheckoutUnavailable } from "@repo/backend/confect/billing/spec";
import { applySubscriptionState } from "@repo/backend/confect/billing/subscriptions";
import spec from "@repo/backend/confect/billing/xendit/checkout.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Array as Arr, Clock, Duration, Effect, Layer, Option } from "effect";

/** An open session is reopened only while it has this long left, so the learner has time to pay on it. */
const REOPEN_MARGIN_MS = Duration.toMillis(Duration.minutes(10));

/** The most open checkouts of one account read at once. A learner opens a few at most, and each closes within the hour. */
const OPEN_CHECKOUT_LIMIT = 10;

/** The user a checkout is for, while the account may still buy: one being deleted or gone withholds it. */
const readBuyer = Effect.fn("billing.xendit.checkout.readBuyer")(function* (
  userId: Docs["users"]["_id"]
) {
  const user = yield* (yield* DatabaseReader)
    .table("users")
    .get(userId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (user === null || isAccountDeletionPending(user)) {
    return yield* new CheckoutUnavailable({
      code: accountUnavailableCode,
      message: accountUnavailableMessage,
    });
  }
  return user;
});

const prepare = FunctionImpl.make(
  databaseSchema,
  spec,
  "prepare",
  Effect.fn("billing.xendit.checkout.prepare")(function* (args) {
    const user = yield* readBuyer(args.userId);
    const reader = yield* DatabaseReader;
    const accountId = yield* ensureAccount({
      owner: { kind: "personal", userId: args.userId },
      rail: "xendit",
      country: "ID",
      currency: "IDR",
    });
    // The account was just ensured, so reading it back always finds the row.
    const account = yield* reader
      .table("billingAccounts")
      .get(accountId)
      .pipe(Effect.orDie);
    const now = yield* Clock.currentTimeMillis;
    const open = yield* reader
      .table("billingCheckouts")
      .index("by_accountId_and_status", (query) =>
        query.eq("accountId", accountId).eq("status", "open")
      )
      .take(OPEN_CHECKOUT_LIMIT)
      .pipe(Effect.orDie);
    const reopened = Arr.findFirst(
      open,
      (checkout) =>
        checkout.offer === args.offer &&
        checkout.expiresAt - now >= REOPEN_MARGIN_MS
    );
    return {
      accountId,
      authId: user.authId,
      email: user.email,
      name: user.name,
      providerCustomerId: account.providerCustomerId,
      openUrl: Option.getOrNull(
        Option.map(reopened, (checkout) => checkout.url)
      ),
    };
  })
);

/**
 * Records the session Xendit opened while the account may still buy: its checkout
 * row, and for a subscription session the pending subscription of its plan. The
 * plan has no provider state yet, so any state Xendit sends for it applies.
 */
const admit = FunctionImpl.make(
  databaseSchema,
  spec,
  "admit",
  Effect.fn("billing.xendit.checkout.admit")(function* (args) {
    yield* readBuyer(args.userId);
    const now = yield* Clock.currentTimeMillis;
    yield* (yield* DatabaseWriter)
      .table("billingCheckouts")
      .insert({
        accountId: args.accountId,
        offer: args.offer,
        rail: "xendit",
        sessionId: args.session.sessionId,
        url: args.session.url,
        status: "open",
        openedAt: now,
        expiresAt: args.session.expiresAt,
        locale: args.locale,
      })
      .pipe(Effect.orDie);
    if (args.session.planId !== null) {
      yield* applySubscriptionState({
        accountId: args.accountId,
        offer: args.offer,
        quantity: 1,
        status: "pending",
        currentPeriodStart: now,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        provider: {
          kind: "xendit",
          planId: args.session.planId,
          tokenId: null,
          channel: null,
        },
        providerUpdatedAt: 0,
      });
    }
    yield* captureProductEvent({
      distinctId: args.userId,
      event: args.event,
      timestamp: now,
    });
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(prepare),
  Layer.provide(admit),
  Layer.provide(atomic),
  GroupImpl.finalize
);
