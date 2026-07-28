import type { validateEvent } from "@polar-sh/sdk/webhooks";
import { internal } from "@repo/backend/convex/_generated/api";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { normalizeStoredCustomer } from "@repo/backend/convex/customers/polar/impl";
import { polarGateway } from "@repo/backend/convex/customers/polar/live";
import type {
  PolarCustomerError,
  PolarCustomerSource,
} from "@repo/backend/convex/customers/polar/spec";
import { convertToDatabaseCustomer } from "@repo/backend/convex/customers/records";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import type { SubscriptionRecord } from "@repo/backend/convex/subscriptions/records/spec";
import { convertToDatabaseSubscription } from "@repo/backend/convex/subscriptions/utils";
import { Effect, Schema } from "effect";

type PolarWebhookEvent = ReturnType<typeof validateEvent>;
const subscriptionWebhookOperationSchema = Schema.Literal("create", "update");
type SubscriptionWebhookOperation = Schema.Schema.Type<
  typeof subscriptionWebhookOperationSchema
>;
const polarCustomerWebhookDispositionSchema = Schema.Literal(
  "discarded",
  "missing",
  "stored"
);
type PolarCustomerWebhookDisposition = Schema.Schema.Type<
  typeof polarCustomerWebhookDispositionSchema
>;

class PolarWebhookIoError extends Schema.TaggedError<PolarWebhookIoError>()(
  "PolarWebhookIoError",
  {
    code: Schema.Literal("POLAR_WEBHOOK_IO_FAILED"),
    message: Schema.String,
  }
) {}

type PolarWebhookFailure = PolarCustomerError | PolarWebhookIoError;

/** Maps Convex action IO into the Polar webhook error channel. */
function tryPolarWebhook<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (error) =>
      new PolarWebhookIoError({
        code: "POLAR_WEBHOOK_IO_FAILED",
        message: getUnknownErrorMessage(error),
      }),
    try: operation,
  });
}

/**
 * Upserts one Polar customer only while its app user remains active.
 *
 * A durable tombstone or deletion-pending user is an accepted discard. A
 * missing app user remains retryable for customer-created delivery ordering.
 */
export const upsertPolarCustomerWebhook: (
  ctx: ActionCtx,
  customer: PolarCustomerSource
) => Effect.Effect<PolarCustomerWebhookDisposition, PolarWebhookFailure> =
  Effect.fn("customers.polar.upsertWebhookCustomer")(function* (
    ctx: ActionCtx,
    customer: PolarCustomerSource
  ) {
    const normalizedCustomer = yield* normalizeStoredCustomer(customer);
    const target = yield* tryPolarWebhook(() =>
      ctx.runQuery(
        internal.customers.queries.internal.customer.resolveWebhookTarget,
        {
          externalId: normalizedCustomer.externalId ?? undefined,
          metadataUserId:
            typeof normalizedCustomer.metadata.userId === "string"
              ? normalizedCustomer.metadata.userId
              : undefined,
          polarCustomerId: normalizedCustomer.id,
        }
      )
    );

    if (target.kind !== "active") {
      return target.kind === "deleted" ? "discarded" : "missing";
    }

    const customerId = yield* tryPolarWebhook(() =>
      ctx.runMutation(internal.customers.mutations.internal.upsertCustomer, {
        customer: convertToDatabaseCustomer({
          ...normalizedCustomer,
          userId: target.userId,
        }),
      })
    );

    return customerId ? "stored" : "discarded";
  });

/**
 * Resolves the authoritative Polar customer before accepting a subscription.
 *
 * This closes late and out-of-order webhook races after account deletion:
 * subscriptions are written only after the current Polar customer maps to an
 * active app user and its local customer row is accepted.
 */
export const upsertPolarSubscriptionWebhook: (
  ctx: ActionCtx,
  subscription: SubscriptionRecord,
  operation: SubscriptionWebhookOperation
) => Effect.Effect<void, PolarWebhookFailure> = Effect.fn(
  "customers.polar.upsertWebhookSubscription"
)(function* (
  ctx: ActionCtx,
  subscription: SubscriptionRecord,
  operation: SubscriptionWebhookOperation
) {
  const customer = yield* polarGateway.getCustomerById(subscription.customerId);

  if (!customer) {
    return;
  }

  const disposition = yield* upsertPolarCustomerWebhook(ctx, customer);

  if (disposition !== "stored") {
    return;
  }

  if (operation === "create") {
    yield* tryPolarWebhook(() =>
      ctx.runMutation(internal.subscriptions.mutations.createSubscription, {
        subscription,
      })
    );
    return;
  }

  yield* tryPolarWebhook(() =>
    ctx.runMutation(internal.subscriptions.mutations.updateSubscription, {
      subscription,
    })
  );
});

/** Drains local state for one terminal Polar customer deletion. */
const deletePolarCustomerWebhook: (
  ctx: ActionCtx,
  polarCustomerId: string
) => Effect.Effect<void, PolarWebhookIoError> = Effect.fn(
  "customers.polar.deleteWebhookCustomer"
)(function* (ctx: ActionCtx, polarCustomerId: string) {
  let hasMore = true;

  while (hasMore) {
    hasMore = yield* tryPolarWebhook(() =>
      ctx.runMutation(
        internal.customers.mutations.internal.deleteCustomerById,
        { id: polarCustomerId }
      )
    );
  }
});

/** Dispatches one already-verified Polar webhook through durable guards. */
export const processPolarWebhookEvent: (
  ctx: ActionCtx,
  event: PolarWebhookEvent
) => Effect.Effect<boolean, PolarWebhookFailure> = Effect.fn(
  "customers.polar.processWebhookEvent"
)(function* (ctx: ActionCtx, event: PolarWebhookEvent) {
  switch (event.type) {
    case "customer.created":
    case "customer.updated": {
      const disposition = yield* upsertPolarCustomerWebhook(ctx, event.data);
      return disposition !== "missing";
    }
    case "customer.deleted": {
      yield* deletePolarCustomerWebhook(ctx, event.data.id);
      return true;
    }
    case "subscription.created": {
      yield* upsertPolarSubscriptionWebhook(
        ctx,
        convertToDatabaseSubscription(event.data),
        "create"
      );
      return true;
    }
    case "subscription.updated":
    case "subscription.active":
    case "subscription.canceled":
    case "subscription.past_due":
    case "subscription.uncanceled":
    case "subscription.revoked": {
      yield* upsertPolarSubscriptionWebhook(
        ctx,
        convertToDatabaseSubscription(event.data),
        "update"
      );
      return true;
    }
    default: {
      return true;
    }
  }
});
