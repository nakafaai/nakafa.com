import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpServerResponse,
  OpenApi,
} from "@effect/platform";
import type { WebhookCustomerCreatedPayload } from "@polar-sh/sdk/models/components/webhookcustomercreatedpayload";
import type { WebhookCustomerUpdatedPayload } from "@polar-sh/sdk/models/components/webhookcustomerupdatedpayload";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { readPolarWebhookSecret } from "@repo/backend/confect/modules/commerce/polar/webhook.env";
import { convertToDatabaseSubscription } from "@repo/backend/confect/modules/commerce/subscriptions.mapper";
import {
  HTTP_ACCEPTED,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_ERROR,
} from "@repo/backend/confect/modules/operations/http.constants";
import { Effect, Layer, Schema } from "effect";

export class PolarWebhookProcessingError extends Schema.TaggedError<PolarWebhookProcessingError>()(
  "PolarWebhookProcessingError",
  { message: Schema.String }
) {}

export class PolarWebhookVerificationFailed extends Schema.TaggedError<PolarWebhookVerificationFailed>()(
  "PolarWebhookVerificationFailed",
  { message: Schema.String }
) {}

type PolarCustomerPayload =
  | WebhookCustomerCreatedPayload["data"]
  | WebhookCustomerUpdatedPayload["data"];

/** Verifies a raw Polar webhook request and returns the typed event payload. */
const verifyPolarEvent = Effect.fn("polar.verifyWebhook")(function* (
  body: string,
  headers: Headers
) {
  const secret = yield* readPolarWebhookSecret();

  return yield* Effect.try({
    try: () =>
      validateEvent(body, Object.fromEntries(headers.entries()), secret),
    catch: (error) => {
      if (error instanceof WebhookVerificationError) {
        return new PolarWebhookVerificationFailed({ message: error.message });
      }

      return new PolarWebhookProcessingError({
        message: error instanceof Error ? error.message : String(error),
      });
    },
  });
});

/** Upserts a local customer row when the webhook can be mapped to an app user. */
const handleCustomerUpsert = Effect.fn("polar.handleCustomerUpsert")(function* (
  customer: PolarCustomerPayload
) {
  const runQuery = yield* QueryRunner;
  const runMutation = yield* MutationRunner;
  const metadataUserId =
    typeof customer.metadata?.userId === "string"
      ? customer.metadata.userId
      : undefined;
  const userId = yield* runQuery(
    refs.internal.customers.queries.internalFunctions.customer
      .getUserIdByPolarCustomer,
    {
      externalId: customer.externalId ?? undefined,
      metadataUserId,
    }
  );

  if (!userId) {
    return false;
  }

  yield* runMutation(
    refs.internal.customers.mutations.internalFunctions.upsertCustomer,
    {
      customer: {
        externalId: customer.externalId ?? null,
        id: customer.id,
        metadata: customer.metadata ?? {},
        userId,
      },
    }
  );

  return true;
});

/** Dispatches a verified Polar webhook to the matching Confect mutation. */
const handlePolarEvent = Effect.fn("polar.handleWebhook")(function* ({
  body,
  headers,
}: {
  readonly body: string;
  readonly headers: Headers;
}) {
  const runMutation = yield* MutationRunner;
  const event = yield* verifyPolarEvent(body, headers);

  switch (event.type) {
    case "customer.created":
    case "customer.updated":
      return yield* handleCustomerUpsert(event.data);
    case "customer.deleted":
      yield* runMutation(
        refs.internal.customers.mutations.internalFunctions.deleteCustomerById,
        { id: event.data.id }
      );
      return true;
    case "subscription.created":
      yield* runMutation(
        refs.internal.subscriptions.mutations.createSubscription,
        {
          subscription: convertToDatabaseSubscription(event.data),
        }
      );
      return true;
    case "subscription.active":
    case "subscription.canceled":
    case "subscription.revoked":
    case "subscription.uncanceled":
    case "subscription.updated":
      yield* runMutation(
        refs.internal.subscriptions.mutations.updateSubscription,
        {
          subscription: convertToDatabaseSubscription(event.data),
        }
      );
      return true;
    default:
      return true;
  }
});

/**
 * Polar's signed webhook API implemented with Confect HttpApi services.
 *
 * References:
 * - https://confect.dev/server/http-api
 * - https://confect.dev/concepts/services
 */
class PolarWebhookGroup extends HttpApiGroup.make("polar")
  .add(
    HttpApiEndpoint.post("events", "/events")
      .addSuccess(Schema.String, { status: HTTP_ACCEPTED })
      .annotate(OpenApi.Description, "Receive signed Polar webhook events.")
  )
  .annotate(OpenApi.Title, "Polar") {}

/** Polar HTTP route contract mounted at `/polar`. */
export class PolarApi extends HttpApi.make("PolarApi")
  .add(PolarWebhookGroup)
  .prefix("/polar")
  .annotate(OpenApi.Title, "Polar Webhooks") {}

/** Handles Polar's raw signed webhook request. */
const PolarWebhookGroupLive = HttpApiBuilder.group(
  PolarApi,
  "polar",
  (handlers) =>
    handlers.handleRaw("events", ({ request }) =>
      Effect.gen(function* () {
        const bodyResult = yield* Effect.either(request.text);

        if (bodyResult._tag === "Left") {
          yield* Effect.logError("Polar webhook body read failed", {
            error: String(bodyResult.left),
          });
          return HttpServerResponse.text("Internal server error", {
            status: HTTP_INTERNAL_ERROR,
          });
        }

        const body = bodyResult.right;
        const headers = new Headers(Object.entries(request.headers));
        const result = yield* Effect.either(
          handlePolarEvent({ body, headers })
        );

        if (result._tag === "Right") {
          if (!result.right) {
            return HttpServerResponse.text("Bad Request: Missing User", {
              status: HTTP_BAD_REQUEST,
            });
          }

          return HttpServerResponse.text("Accepted", {
            status: HTTP_ACCEPTED,
          });
        }

        if (result.left._tag === "PolarWebhookVerificationFailed") {
          yield* Effect.logWarning("Polar webhook verification failed", {
            error: result.left.message,
          });
          return HttpServerResponse.text("Forbidden", {
            status: HTTP_FORBIDDEN,
          });
        }

        yield* Effect.logError("Polar webhook processing failed", {
          error: result.left.message,
        });
        return HttpServerResponse.text("Internal server error", {
          status: HTTP_INTERNAL_ERROR,
        });
      })
    )
);

/** Live Polar HTTP API layer consumed by the Confect router. */
export const PolarApiLive = HttpApiBuilder.api(PolarApi).pipe(
  Layer.provide(PolarWebhookGroupLive)
);
