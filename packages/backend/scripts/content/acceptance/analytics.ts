import { createServer } from "node:http";
import { NodeHttpServer, NodeSocketServer } from "@effect/platform-node";
import {
  AD_SCRIPT,
  AD_SCRIPT_PATH,
} from "@repo/backend/scripts/content/acceptance/ads";
import {
  BUCKET_PATH,
  bucketStandIn,
} from "@repo/backend/scripts/content/acceptance/bucket";
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
 * Stands in for PostHog ingestion, for Google's ad script and for the R2 bucket
 * while acceptance serves the app. The browser sends analytics straight to the
 * proxy host, which is this origin, so each request is accepted and discarded. A
 * preflight gets an empty answer that permits it, so no request fails against a
 * closed port and the browser client never retries. `AD_SCRIPT_PATH` answers
 * the ad script's stand-in, which the page loads across origins. Every path
 * under `BUCKET_PATH` is the bucket's S3 API, which keeps its objects in the
 * runtime directory.
 * @see https://posthog.com/docs/api/capture
 */
export const withAnalyticsSink = Effect.fn(
  "contentAcceptance.withAnalyticsSink"
)(function* <A, E, R>(
  origin: string,
  directory: string,
  program: Effect.Effect<A, E, R>
) {
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
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) => {
      if (request.url.startsWith(`${BUCKET_PATH}/`)) {
        return bucketStandIn(directory);
      }
      if (request.url.startsWith(AD_SCRIPT_PATH)) {
        return Effect.succeed(
          HttpServerResponse.text(AD_SCRIPT, {
            contentType: "text/javascript",
            headers: CROSS_ORIGIN_HEADERS,
          })
        );
      }
      return request.method === "OPTIONS"
        ? Effect.succeed(
            HttpServerResponse.empty({
              headers: CROSS_ORIGIN_HEADERS,
              status: 204,
            })
          )
        : HttpServerResponse.json(
            { status: 1 },
            { headers: CROSS_ORIGIN_HEADERS }
          );
    })
  );
  return yield* program;
}, Effect.scoped);
