import "@tanstack/react-start/server-only";
import {
  type AnyPublicQuery,
  type Args,
  decodeReturns,
  encodeArgs,
  getFunctionReference,
} from "@confect/core/Ref";
import { ConvexHttpClient } from "convex/browser";
import { Config, Effect, Schema } from "effect";

/** A Convex read that failed on the server, before its value could be decoded. */
export class PreloadFailed extends Schema.TaggedError<PreloadFailed>()(
  "PreloadFailed",
  { cause: Schema.Unknown }
) {}

/** The address of the Convex deployment, read at runtime by the server. */
const CONVEX_URL = Config.NonEmptyString("VITE_CONVEX_URL");

/**
 * Reads one Confect query for one request, with the request's token, and
 * decodes its value with the Schema of the query. The client is made for this
 * call: `setAuth` mutates the client, so a shared one would hand one reader's
 * data to another request. A request without a token reads as a visitor.
 */
export const preloadConfectQuery = Effect.fn("www.data.preloadQuery")(
  function* <Query extends AnyPublicQuery>(
    ref: Query,
    args: Args<Query>,
    token: string | undefined
  ) {
    const address = yield* CONVEX_URL;
    const encodedArgs = yield* encodeArgs(ref, args);
    const client = new ConvexHttpClient(address);
    if (token !== undefined) {
      client.setAuth(token);
    }
    const encodedValue = yield* Effect.tryPromise({
      catch: (cause) => new PreloadFailed({ cause }),
      try: () => client.query(getFunctionReference(ref), encodedArgs),
    });
    return yield* decodeReturns(ref, encodedValue);
  }
);
