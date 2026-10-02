import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { Effect } from "effect";
import { HttpServer, HttpServerResponse } from "effect/http";

const listen = (port: number) =>
  NodeHttpServer.make(createServer, { host: "127.0.0.1", port });

/**
 * Picks a free loopback origin for the analytics stand-in. The build bakes the
 * PostHog proxy upstream into its rewrites, so prepare picks the origin once
 * and every start serves the stand-in there.
 */
export const reserveAnalyticsOrigin = Effect.fn(
  "contentAcceptance.reserveAnalyticsOrigin"
)(function* () {
  const server = yield* listen(0);
  return HttpServer.formatAddress(server.address);
}, Effect.scoped);

/**
 * Stands in for PostHog ingestion while acceptance serves the app. The app's
 * same-origin proxy forwards every analytics request here, and each one is
 * accepted and discarded, so no request fails against a closed port and the
 * browser client never retries.
 * @see https://posthog.com/docs/api/capture
 */
export const withAnalyticsSink = Effect.fn(
  "contentAcceptance.withAnalyticsSink"
)(function* <A, E, R>(origin: string, program: Effect.Effect<A, E, R>) {
  const server = yield* listen(Number(new URL(origin).port)).pipe(
    Effect.catchTag("ServeError", () =>
      acceptanceRuntimeError(
        `The saved analytics stand-in port at ${origin} is occupied; its process is preserved.`
      )
    )
  );
  yield* server.serve(HttpServerResponse.json({ status: 1 }));
  return yield* program;
}, Effect.scoped);
