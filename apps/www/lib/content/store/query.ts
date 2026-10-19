import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "@tanstack/react-start/server-only";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, type Schema } from "effect";
import { readContentStore } from "@/lib/content/store/read";
import { httpLayer } from "@/lib/convex/http";

/** The codec that a query's own function spec declares for its result. */
function readReturnsCodec<Query extends Ref.AnyConfectPublicQuery>(
  ref: Query
): Schema.Codec<Ref.Returns<Query>, unknown> {
  return ref.returns;
}

/**
 * Runs a Convex query through the content store, so that the same query with
 * the same arguments reaches Convex once for each active release.
 *
 * The function name is the kind of read and the arguments are its parts, so no
 * argument can be left out of the key. The stored value is described by the
 * result schema of the query's own spec, which stays the only owner of its
 * shape. Only a query that depends on nothing but the active content release
 * belongs here.
 */
export const queryContentStore = Effect.fn("www.content.store.query")(
  function* <Query extends Ref.AnyConfectPublicQuery>(
    ref: Query,
    ...rest: Ref.OptionalArgs<Query>
  ) {
    return yield* readContentStore({
      kind: ref.convexFunctionName,
      load: Effect.flatMap(HttpClient.HttpClient, (client) =>
        client.query(ref, ...rest)
      ).pipe(Effect.provide(httpLayer())),
      parts: [encodeJsonText(rest[0] ?? {})],
      schema: readReturnsCodec(ref),
    });
  }
);
