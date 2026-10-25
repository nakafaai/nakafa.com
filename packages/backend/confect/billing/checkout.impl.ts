import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
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
  Layer.provide(holdsProQuery),
  Layer.provide(atomic),
  GroupImpl.finalize
);
