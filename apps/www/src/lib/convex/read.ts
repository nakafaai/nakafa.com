import { Ref } from "@confect/core";
import type { ConvexReactClient } from "convex/react";
import { Effect, Schema } from "effect";
import { clientEnv } from "@/env.public";
import { readConvexClient } from "@/lib/convex/client";

/**
 * A browser Convex read that failed without one of the query's typed refusals:
 * the network, the deployment, or an answer whose shape does not decode.
 */
export class QueryReadFailed extends Schema.TaggedError<
  QueryReadFailed,
  { readonly brand: unique symbol }
>()("QueryReadFailed", { cause: Schema.Unknown }) {}

/** The one query method shared by `ConvexReactClient` and `ConvexHttpClient`. */
export type QueryClient = Pick<ConvexReactClient, "query">;

/**
 * Runs one Confect query on the given Convex client, decoding its answer and
 * any typed refusal it declares. Unknown failures and decoding errors arrive as
 * `QueryReadFailed`.
 */
export const readQueryOn = Effect.fn("convex.readQueryOn")(function* <
  Query extends Ref.AnyPublicQuery,
>(client: QueryClient, ref: Query, args: Ref.Args<Query>) {
  return yield* Ref.runWithCodec(
    ref,
    args,
    (reference, encodedArgs) => client.query(reference, encodedArgs),
    (cause) => new QueryReadFailed({ cause })
  ).pipe(
    Effect.catchTag("SchemaError", (cause) =>
      Effect.fail(new QueryReadFailed({ cause }))
    )
  );
});

/**
 * Reads one query once on the browser's Convex client, over its open socket, for a route's
 * loader after a press: the page commits with the rows its header names, in one Convex round
 * trip and with no Worker request (ADR 0038 D2). An intent preload runs the same loader before
 * the press, so the press finds the answer waiting. The page reads the same query live, so a
 * failed read leaves it to the page, which shows its own failure or refusal.
 */
export const readOnce = Effect.fn("convex.readOnce")(function* <
  Query extends Ref.AnyPublicQuery,
>(ref: Query, args: Ref.Args<Query>) {
  const encoded = yield* Effect.tryPromise(() =>
    readConvexClient(clientEnv.VITE_CONVEX_URL).query(
      Ref.getFunctionReference(ref),
      Ref.encodeArgsSync(ref, args)
    )
  );
  return yield* Effect.try(() => Ref.decodeReturnsSync(ref, encoded));
});
