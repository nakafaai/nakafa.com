import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  OpenApi,
} from "@effect/platform";
import { Clock, Effect, Layer, Schema } from "effect";

const V1_HEALTH_STATUS = "ok";

export const v1Metadata = {
  docs: "https://docs.nakafa.com/api",
  status: "active",
  version: "1.0.0",
} as const;

const V1Metadata = Schema.Struct({
  docs: Schema.Literal(v1Metadata.docs),
  status: Schema.Literal(v1Metadata.status),
  version: Schema.Literal(v1Metadata.version),
});

const V1Health = Schema.Struct({
  status: Schema.Literal(V1_HEALTH_STATUS),
  timestamp: Schema.Number,
});

/**
 * Public API v1 implemented through Confect HttpApi.
 *
 * References:
 * - https://confect.dev/server/http-api
 * - https://effect.website/docs/schema/advanced-usage/
 */
class V1Group extends HttpApiGroup.make("v1")
  .add(
    HttpApiEndpoint.get("metadata", "/")
      .addSuccess(V1Metadata)
      .annotate(OpenApi.Description, "Read the public API metadata.")
  )
  .add(
    HttpApiEndpoint.get("health", "/health")
      .addSuccess(V1Health)
      .annotate(OpenApi.Description, "Read the public API readiness status.")
  )
  .annotate(OpenApi.Title, "API v1") {}

/** Public API v1 route contract. */
export class V1Api extends HttpApi.make("V1Api")
  .add(V1Group)
  .prefix("/v1")
  .annotate(OpenApi.Title, "Nakafa API") {}

/** Implements API v1 endpoints with Effect handlers. */
const V1GroupLive = HttpApiBuilder.group(V1Api, "v1", (handlers) =>
  handlers
    .handle("metadata", () => Effect.succeed(v1Metadata))
    .handle("health", () =>
      Effect.map(Clock.currentTimeMillis, (timestamp) => ({
        status: V1_HEALTH_STATUS,
        timestamp,
      }))
    )
);

/** Live v1 HTTP API layer consumed by the Confect router. */
export const V1ApiLive = HttpApiBuilder.api(V1Api).pipe(
  Layer.provide(V1GroupLive)
);
