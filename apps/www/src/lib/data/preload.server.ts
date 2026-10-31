import {
  type AnyPublicQuery,
  type Args,
  runWithCodec,
} from "@confect/core/Ref";
import {
  RetryableNetworkAttempt,
  retryNetworkAttempt,
} from "@repo/backend/client/network";
import { ConvexHttpClient } from "convex/browser";
import { Effect, Schema } from "effect";
import { ConvexGatewayFailure, failAtGateway } from "@/lib/convex/http";
import { CONVEX_URL } from "@/lib/server/runtime";

/**
 * A Convex read that failed without one of the query's typed refusals: the
 * network, the deployment, or an answer whose shape does not decode.
 */
export class PreloadFailed extends Schema.TaggedError<PreloadFailed>()(
  "PreloadFailed",
  { cause: Schema.Unknown }
) {}

/**
 * Reads one Confect query for one request, with the request's token. A refusal
 * that the query declares arrives as the query's own typed error, decoded from
 * the Convex error, so the caller maps it. Any other failure, including an answer
 * that does not decode, is a `PreloadFailed`. The client is made for this call:
 * `setAuth` mutates the client, so a shared one would hand one reader's data to
 * another request. A request without a token reads as a visitor. A gateway that
 * stands in for Convex ran nothing, so the read goes again on the shared schedule:
 * one lost answer must not fail a page, and in a build it would fail a deploy.
 */
export const preloadConfectQuery = Effect.fn("www.data.preloadQuery")(
  function* <Query extends AnyPublicQuery>(
    ref: Query,
    args: Args<Query>,
    token: string | undefined
  ) {
    const address = yield* CONVEX_URL;
    const client = new ConvexHttpClient(address, {
      fetch: failAtGateway(fetch),
    });
    if (token !== undefined) {
      client.setAuth(token);
    }
    return yield* retryNetworkAttempt(
      runWithCodec(
        ref,
        args,
        (reference, encodedArgs) => client.query(reference, encodedArgs),
        (cause) => new PreloadFailed({ cause })
      ).pipe(
        Effect.catchTag("SchemaError", (cause) =>
          Effect.fail(new PreloadFailed({ cause }))
        ),
        Effect.mapError((error) =>
          Schema.is(PreloadFailed)(error) &&
          error.cause instanceof ConvexGatewayFailure
            ? new RetryableNetworkAttempt({ failure: error })
            : error
        )
      ),
      new PreloadFailed({ cause: "deadline" })
    );
  }
);
