import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { authReader } from "@repo/backend/confect/auth/reader";
import {
  ensureAccount,
  recordProviderCustomer,
} from "@repo/backend/confect/billing/accounts";
import {
  admitCheckoutProgram,
  holdsPro,
} from "@repo/backend/confect/billing/checkout";
import spec from "@repo/backend/confect/billing/checkout.spec";
import { billingCurrencyFor } from "@repo/backend/confect/billing/route";
import { checkoutSessionIoError } from "@repo/backend/confect/billing/spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Clock, Effect, flow, Layer } from "effect";

/** The country a personal Polar account is made with: Polar decides the buyer's country at checkout, so Nakafa holds it as unknown. */
const POLAR_ACCOUNT_COUNTRY = "ZZ";

const openAccount = FunctionImpl.make(
  databaseSchema,
  spec,
  "openAccount",
  Effect.fn("billing.checkout.openAccount")(function* (args) {
    const reader = yield* DatabaseReader;
    const user = yield* reader
      .table("users")
      .get(args.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (user === null || isAccountDeletionPending(user)) {
      return { kind: "unavailable" as const };
    }
    const accountId = yield* ensureAccount({
      owner: { kind: "personal", userId: args.userId },
      rail: "polar",
      country: POLAR_ACCOUNT_COUNTRY,
      currency: billingCurrencyFor(POLAR_ACCOUNT_COUNTRY),
    });
    // The account was just ensured, so reading it back always finds the row.
    const account = yield* reader
      .table("billingAccounts")
      .get(accountId)
      .pipe(Effect.orDie);
    return {
      kind: "open" as const,
      accountId,
      authId: user.authId,
      email: user.email,
      name: user.name,
      providerCustomerId: account.providerCustomerId,
    };
  })
);

const recordCustomer = FunctionImpl.make(
  databaseSchema,
  spec,
  "recordCustomer",
  Effect.fn("billing.checkout.recordCustomer")(function* (args) {
    yield* recordProviderCustomer(args.accountId, args.providerCustomerId);
    return null;
  })
);

const admitCheckout = FunctionImpl.make(
  databaseSchema,
  spec,
  "admitCheckout",
  Effect.fn("billing.checkout.admit")(function* (args) {
    const reader = yield* DatabaseReader;
    return yield* admitCheckoutProgram({
      captureEvent: () =>
        captureProductEvent({
          distinctId: args.userId,
          event: args.event,
          ...(args.timestamp === undefined
            ? {}
            : { timestamp: args.timestamp }),
        }),
      loadUser: Effect.fn("billing.checkout.loadAdmissionUser")(
        function* () {
          return yield* reader
            .table("users")
            .get(args.userId)
            .pipe(
              Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
              Effect.orDie
            );
        },
        Effect.catchDefect(flow(checkoutSessionIoError, Effect.fail))
      ),
    });
  })
);

/**
 * Whether a user may take over the Polar customer that already holds their email address,
 * named by its external ID. A customer under the user's own ID is theirs. Any other one only a
 * verified address may claim, and only when no Nakafa user holds it: one Polar has no external ID
 * for, or one left by an account that no longer exists. Polar's portal opens a customer to whoever
 * reads its mailbox, so the verified owner of that mailbox gains nothing Polar would not show them.
 */
const mayAdoptCustomer = FunctionImpl.make(
  databaseSchema,
  spec,
  "mayAdoptCustomer",
  Effect.fn("billing.checkout.mayAdoptCustomer")(function* (args) {
    const reader = yield* DatabaseReader;
    const user = yield* reader
      .table("users")
      .get(args.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (user === null || isAccountDeletionPending(user)) {
      return false;
    }
    if (args.externalId === user.authId) {
      return true;
    }
    const ctx = yield* QueryCtx;
    const authUser = yield* Effect.promise(() =>
      authReader.getAnyUserById(ctx, user.authId)
    );
    if (authUser?.emailVerified !== true) {
      return false;
    }
    if (args.externalId === null) {
      return true;
    }
    const holder = yield* reader
      .table("users")
      .get("by_authId", args.externalId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    return holder === null;
  })
);

const holdsProQuery = FunctionImpl.make(
  databaseSchema,
  spec,
  "holdsPro",
  Effect.fn("billing.checkout.holdsProQuery")(function* (args) {
    return yield* holdsPro(args.userId, yield* Clock.currentTimeMillis);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(openAccount),
  Layer.provide(recordCustomer),
  Layer.provide(admitCheckout),
  Layer.provide(mayAdoptCustomer),
  Layer.provide(holdsProQuery),
  Layer.provide(atomic),
  GroupImpl.finalize
);
