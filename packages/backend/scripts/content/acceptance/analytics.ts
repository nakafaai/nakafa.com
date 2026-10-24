import { createServer } from "node:http";
import { NodeHttpServer, NodeSocketServer } from "@effect/platform-node";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { Effect } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";

/**
 * Picks a free loopback origin for the analytics stand-in. The build bakes the
 * PostHog proxy host into the browser client, so prepare picks the origin once
 * and every start serves the stand-in there.
 */
export const reserveAnalyticsOrigin = Effect.fn(
  "contentAcceptance.reserveAnalyticsOrigin"
)(function* () {
  const server = yield* NodeSocketServer.make({ host: "127.0.0.1", port: 0 });
  return HttpServer.formatAddress(server.address);
}, Effect.scoped);

/** The headers that let the app's origin read each answer of the stand-in. */
const CROSS_ORIGIN_HEADERS = {
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-origin": "*",
};

/**
 * Stands in for PostHog ingestion while acceptance serves the app. The browser
 * sends analytics straight to the proxy host, which is this origin, so each
 * request is accepted and discarded. A preflight gets an empty answer that
 * permits it, so no request fails against a closed port and the browser client
 * never retries.
 * @see https://posthog.com/docs/api/capture
 */
export const withAnalyticsSink = Effect.fn(
  "contentAcceptance.withAnalyticsSink"
)(function* <A, E, R>(origin: string, program: Effect.Effect<A, E, R>) {
  const server = yield* NodeHttpServer.make(createServer, {
    host: "127.0.0.1",
    port: Number(new URL(origin).port),
  }).pipe(
    Effect.catchTag("ServeError", () =>
      acceptanceRuntimeError(
        `The saved analytics stand-in port at ${origin} is occupied; its process is preserved.`
      )
    )
  );
  yield* server.serve(
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
      request.method === "OPTIONS"
        ? Effect.succeed(
            HttpServerResponse.empty({
              headers: CROSS_ORIGIN_HEADERS,
              status: 204,
            })
          )
        : HttpServerResponse.json(
            { status: 1 },
            { headers: CROSS_ORIGIN_HEADERS }
          )
    )
  );
  return yield* program;
}, Effect.scoped);
