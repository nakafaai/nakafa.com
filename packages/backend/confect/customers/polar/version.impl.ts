import { FunctionImpl, GroupImpl } from "@confect/server";
import { createWebhooksService } from "@polar-sh/sdk/2026-10/services/webhooks";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { readPolarClient } from "@repo/backend/confect/customers/polar/client";
import spec from "@repo/backend/confect/customers/polar/version.spec";
import { Effect, Layer } from "effect";

/** The payload version the webhook route decodes: the SDK path it imports. */
const WEBHOOK_VERSION = "2026-10";
/** One page holds every endpoint: an organization has a handful. */
const ENDPOINT_LIMIT = 100;

const setWebhookVersion = FunctionImpl.make(
  databaseSchema,
  spec,
  "setWebhookVersion",
  Effect.fn("customers.polar.version.setWebhookVersion")(function* () {
    const client = yield* Effect.orDie(readPolarClient());
    const webhooks = createWebhooksService(client);
    const endpoints = yield* Effect.orDie(
      Effect.tryPromise(() =>
        webhooks.listWebhookEndpoints({ limit: ENDPOINT_LIMIT })
      )
    );
    return yield* Effect.forEach(endpoints.items, (endpoint) =>
      endpoint.api_version === WEBHOOK_VERSION
        ? Effect.succeed({
            after: endpoint.api_version,
            before: endpoint.api_version,
            id: endpoint.id,
          })
        : Effect.map(
            Effect.orDie(
              Effect.tryPromise(() =>
                webhooks.updateWebhookEndpoint(endpoint.id, {
                  api_version: WEBHOOK_VERSION,
                })
              )
            ),
            (updated) => ({
              after: updated.api_version,
              before: endpoint.api_version,
              id: endpoint.id,
            })
          )
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(setWebhookVersion),
  GroupImpl.finalize
);
