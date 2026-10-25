import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import { resolvePolarCustomer } from "@repo/backend/confect/billing/polar/resolve";
import type { PolarSubscriptionOutcome } from "@repo/backend/confect/billing/polar/spec";
import { applyPolarSubscription } from "@repo/backend/confect/billing/polar/webhook";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Duration, Effect, Option, Schema } from "effect";

/** Subscriptions one listing page asks Polar for, so one request stays small. */
const RECONCILE_PAGE_SIZE = 100;
/** Pages one run reads before it schedules the next run from the page it stopped at, so a run stays bounded. */
const RECONCILE_PAGES_PER_RUN = 10;

/** How the subscriptions of one run came out. `unresolved` counts a customer Nakafa could not link. */
type ReconcileOutcome =
  | "applied"
  | "invalid"
  | "stale"
  | "unresolved"
  | "unsupported";

/** One listed page: the subscriptions it holds, and the last page Polar lists. */
const ListedPage = Schema.Struct({
  items: Schema.Array(Schema.Unknown),
  maxPage: Schema.Int,
});
type ListedPage = typeof ListedPage.Type;

/**
 * Applies one subscription, given as the JSON text Polar listed it with, through
 * the path a webhook takes. Its customer is resolved against Polar once when Nakafa
 * holds no account for it, and the subscription is applied again once it links.
 */
export const applyReconciledSubscription = Effect.fn(
  "billing.reconcile.applySubscription"
)(function* (subscription: string) {
  const decoded = Schema.decodeOption(JsonTextSchema)(subscription);
  if (Option.isNone(decoded)) {
    return "invalid" as const;
  }
  return yield* applyPolarSubscription(decoded.value);
});

/** Applies one listed subscription and says what became of it, linking its customer on the way when Nakafa holds no account for it. */
const applyListed = Effect.fn("billing.reconcile.applyListed")(function* (
  subscription: unknown
) {
  const { runMutation } = yield* MutationRunner;
  const json = encodeJsonText(subscription);
  const first: PolarSubscriptionOutcome = yield* runMutation(
    refs.internal.billing.reconcile.applySubscription,
    { subscription: json }
  ).pipe(Effect.orDie);
  if (typeof first === "string") {
    return first;
  }
  // A customer that cannot be read is counted as unresolved, so one bad customer never stops the run.
  const resolution = yield* resolvePolarCustomer(first.customerId).pipe(
    Effect.catchTag("PolarCustomerError", (error) =>
      Effect.logError(
        "Polar customer of a listed subscription could not be read",
        {
          customerId: first.customerId,
          message: error.message,
        }
      ).pipe(Effect.as("unresolved" as const))
    )
  );
  if (resolution === "unresolved") {
    return "unresolved" as const;
  }
  const second: PolarSubscriptionOutcome = yield* runMutation(
    refs.internal.billing.reconcile.applySubscription,
    { subscription: json }
  ).pipe(Effect.orDie);
  return typeof second === "string" ? second : ("unresolved" as const);
});

/**
 * Brings every Polar subscription that holds access or owes a payment into the
 * billing model, reading up to a bounded number of pages per run. Each run schedules
 * the next run from the page it stopped at, so a large account list is reconciled over
 * several runs. Applying a subscription is idempotent: a state Nakafa already holds is
 * applied again without change, and a stale state is refused. Logs the counts of the
 * run.
 */
export const reconcilePolarSubscriptions = Effect.fn("billing.reconcile.run")(
  function* (startPage: number) {
    const tally: Record<ReconcileOutcome, number> = {
      applied: 0,
      invalid: 0,
      stale: 0,
      unresolved: 0,
      unsupported: 0,
    };
    let page: number | null = startPage;
    let pagesRead = 0;
    while (page !== null && pagesRead < RECONCILE_PAGES_PER_RUN) {
      const listed: ListedPage = yield* polarGateway.listSubscriptions(
        page,
        RECONCILE_PAGE_SIZE
      );
      for (const subscription of listed.items) {
        const outcome = yield* applyListed(subscription);
        tally[outcome] += 1;
      }
      pagesRead += 1;
      page = page < listed.maxPage ? page + 1 : null;
    }
    if (page !== null) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.billing.reconcile.run,
        { page }
      );
    }
    yield* Effect.logInfo("Polar subscriptions reconciled", {
      ...tally,
      nextPage: page,
      pagesRead,
    });
    return null;
  }
);
