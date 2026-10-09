import type { webhooks } from "@polar-sh/sdk/2026-10";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { normalizeStoredCustomer } from "@repo/backend/confect/customers/polar/impl";
import { polarGateway } from "@repo/backend/confect/customers/polar/live";
import {
  decodePolarCustomer,
  decodePolarCustomerId,
  decodePolarSubscription,
  type PolarCustomerSource,
  PolarPayloadError,
} from "@repo/backend/confect/customers/polar/payload";
import { convertToDatabaseCustomer } from "@repo/backend/confect/customers/records";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import type { SubscriptionRecord } from "@repo/backend/confect/subscriptions/records/spec";
import { convertToDatabaseSubscription } from "@repo/backend/confect/subscriptions/utils";
import { Effect, flow, Schema } from "effect";

type PolarWebhookEvent = webhooks.WebhookPayload;
const subscriptionWebhookOperationSchema = Schema.Literals([
  "create",
  "update",
]);
type SubscriptionWebhookOperation =
  typeof subscriptionWebhookOperationSchema.Type;
class PolarWebhookIoError extends Schema.TaggedError<PolarWebhookIoError>()(
  "PolarWebhookIoError",
  {
    code: Schema.Literal("POLAR_WEBHOOK_IO_FAILED"),
    message: Schema.String,
  }
) {}
/** Maps Convex action IO into the Polar webhook error channel. */
function toPolarWebhookIoError(error: unknown) {
  return PolarWebhookIoError.make({
    code: "POLAR_WEBHOOK_IO_FAILED",
    message: getUnknownErrorMessage(error),
  });
}

/**
 * Upserts one Polar customer only while its app user remains active.
 *
 * A durable tombstone or deleted user is an accepted discard. A missing user
 * or cancelable deletion preparation remains retryable.
 */
export const upsertPolarCustomerWebhook = Effect.fn(
  "customers.polar.upsertWebhookCustomer"
)(function* (customer: PolarCustomerSource) {
  const { runQuery } = yield* QueryRunner;
  const { runMutation } = yield* MutationRunner;
  const normalizedCustomer = yield* normalizeStoredCustomer(customer);
  const target = yield* runQuery(
    refs.internal.customers.queries.internal.customer.resolveWebhookTarget,
    {
      ...(normalizedCustomer.externalId === null
        ? {}
        : {
            externalId: normalizedCustomer.externalId,
          }),
      ...(typeof normalizedCustomer.metadata.userId === "string"
        ? {
            metadataUserId: normalizedCustomer.metadata.userId,
          }
        : {}),
      polarCustomerId: normalizedCustomer.id,
    }
  ).pipe(
    Effect.mapError(toPolarWebhookIoError),
    Effect.catchDefect(flow(toPolarWebhookIoError, Effect.fail))
  );
  if (target.kind !== "active") {
    return target.kind === "deleted" ? "discarded" : "missing";
  }
  const result = yield* runMutation(
    refs.internal.customers.mutations.internal.upsertCustomer,
    {
      customer: convertToDatabaseCustomer({
        ...normalizedCustomer,
        userId: target.userId,
      }),
    }
  ).pipe(
    Effect.mapError(toPolarWebhookIoError),
    Effect.catchDefect(flow(toPolarWebhookIoError, Effect.fail))
  );
  if (result.kind === "stored") {
    return "stored";
  }
  return result.kind === "prepared" ? "missing" : "discarded";
});
/**
 * Resolves the authoritative Polar customer before accepting a subscription.
 *
 * This closes late and out-of-order webhook races after account deletion:
 * subscriptions are written only after the current Polar customer maps to an
 * active app user and its local customer row is accepted.
 */
export const upsertPolarSubscriptionWebhook = Effect.fn(
  "customers.polar.upsertWebhookSubscription"
)(function* (
  subscription: SubscriptionRecord,
  operation: SubscriptionWebhookOperation
) {
  const { runMutation } = yield* MutationRunner;
  const customer = yield* polarGateway.getCustomerById(subscription.customerId);
  if (!customer) {
    return "discarded";
  }
  const disposition = yield* upsertPolarCustomerWebhook(customer);
  if (disposition !== "stored") {
    return disposition;
  }
  if (operation === "create") {
    yield* runMutation(
      refs.internal.subscriptions.mutations.createSubscription,
      {
        subscription,
      }
    ).pipe(
      Effect.mapError(toPolarWebhookIoError),
      Effect.catchDefect(flow(toPolarWebhookIoError, Effect.fail))
    );
    return "stored";
  }
  yield* runMutation(refs.internal.subscriptions.mutations.updateSubscription, {
    subscription,
  }).pipe(
    Effect.mapError(toPolarWebhookIoError),
    Effect.catchDefect(flow(toPolarWebhookIoError, Effect.fail))
  );
  return "stored";
});
/** Drains local state for one terminal Polar customer deletion. */
const deletePolarCustomerWebhook = Effect.fn(
  "customers.polar.deleteWebhookCustomer"
)(function* (polarCustomerId: string) {
  const { runMutation } = yield* MutationRunner;
  let hasMore = true;
  while (hasMore) {
    hasMore = yield* runMutation(
      refs.internal.customers.mutations.internal.deleteCustomerById,
      {
        id: polarCustomerId,
      }
    ).pipe(
      Effect.mapError(toPolarWebhookIoError),
      Effect.catchDefect(flow(toPolarWebhookIoError, Effect.fail))
    );
  }
});
/** Dispatches one already-verified Polar webhook through durable guards. */
export const processPolarWebhookEvent = Effect.fn(
  "customers.polar.processWebhookEvent"
)(function* (event: PolarWebhookEvent) {
  switch (event.type) {
    case "customer.created":
    case "customer.updated": {
      const customer = yield* decodePolarCustomer(event.data);
      // A customer the normalizer cannot store is a payload this handler cannot read.
      const disposition = yield* upsertPolarCustomerWebhook(customer).pipe(
        Effect.catchTag("PolarCustomerError", (error) =>
          Effect.fail(
            PolarPayloadError.make({ cause: error, message: error.message })
          )
        )
      );
      return disposition !== "missing";
    }
    case "customer.deleted": {
      const customer = yield* decodePolarCustomerId(event.data);
      yield* deletePolarCustomerWebhook(customer.id);
      return true;
    }
    case "subscription.created": {
      const subscription = yield* decodePolarSubscription(event.data);
      const disposition = yield* upsertPolarSubscriptionWebhook(
        convertToDatabaseSubscription(subscription),
        "create"
      );
      return disposition !== "missing";
    }
    case "subscription.updated":
    case "subscription.active":
    case "subscription.canceled":
    case "subscription.past_due":
    case "subscription.uncanceled":
    case "subscription.revoked": {
      const subscription = yield* decodePolarSubscription(event.data);
      const disposition = yield* upsertPolarSubscriptionWebhook(
        convertToDatabaseSubscription(subscription),
        "update"
      );
      return disposition !== "missing";
    }
    default: {
      // No handler reads this type, so its data is never decoded and Polar stops retrying it.
      return true;
    }
  }
});
