import { Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";

/**
 * The Fetch-backed HTTP client for requests that leave the process.
 *
 * Effect's client adds `traceparent` and `b3` headers to every request. Nakafa
 * exports no traces, so those headers would hand random identifiers to third
 * parties, force a CORS preflight on cross-origin browser requests, and break
 * endpoints that expect an exact header set.
 */
export const FetchClient = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(HttpClient.TracerPropagationEnabled, false))
);
