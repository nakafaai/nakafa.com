import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "@tanstack/react-start/server-only";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, type Schema } from "effect";
import type {
  ActiveContentReleaseId,
  ContentSnapshotFamily,
} from "@/lib/content/published/active";
import { readContentStore } from "@/lib/content/store/read";
import { httpLayer } from "@/lib/convex/http";

/** The codec that a query's own function spec declares for its result. */
function readReturnsCodec<Query extends Ref.AnyConfectPublicQuery>(
  ref: Query
): Schema.Codec<Ref.Returns<Query>, unknown> {
  return ref.returns;
}

/**
 * The store read of one Convex query: the function name is the kind of read and
 * the arguments are its parts, so no argument can be left out of the key, and the
 * query's own spec describes the stored value.
 */
function queryRead<Query extends Ref.AnyConfectPublicQuery>(
  ref: Query,
  rest: Ref.OptionalArgs<Query>
) {
  return {
    kind: ref.convexFunctionName,
    load: Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(ref, ...rest)
    ).pipe(Effect.provide(httpLayer())),
    parts: [encodeJsonText(rest[0] ?? {})],
    schema: readReturnsCodec(ref),
  };
}

/**
 * Runs a Convex query through the content store under the release that the
 * caller already read, so every read of one operation answers from one
 * release. The store owns that check: a read whose release is no longer active
 * fails with `PublishedReleaseMismatchError` and never moves to another
 * release. Without a release, the read follows the active release, as
 * `queryContentStore` does.
 *
 * Only a query that depends on nothing but the content release belongs here: a
 * read that depends on a viewer, a free-text query, or live analytics goes to
 * Convex on its own.
 */
export const queryPinnedContentStore = Effect.fn(
  "www.content.store.queryPinned"
)(function* <Query extends Ref.AnyConfectPublicQuery>(
  release: ActiveContentReleaseId | undefined,
  ref: Query,
  ...rest: Ref.OptionalArgs<Query>
) {
  return yield* readContentStore({
    ...queryRead(ref, rest),
    ...(release === undefined ? {} : { release }),
  });
});

/**
 * Runs a Convex query through the content store, so that the same query with
 * the same arguments reaches Convex once for each active release.
 */
export const queryContentStore = Effect.fn("www.content.store.query")(
  function* <Query extends Ref.AnyConfectPublicQuery>(
    ref: Query,
    ...rest: Ref.OptionalArgs<Query>
  ) {
    return yield* queryPinnedContentStore(undefined, ref, ...rest);
  }
);

/**
 * Runs a Convex query of one structured family through the content store, keyed
 * by the snapshot that the family resolves to under the active release. A release
 * that does not change the family keeps its snapshot, so the same query with the
 * same arguments reaches Convex once for each snapshot, across releases. Only a
 * query whose answer depends on nothing but that family's snapshot belongs here.
 */
export const querySnapshotContentStore = Effect.fn(
  "www.content.store.querySnapshot"
)(function* <Query extends Ref.AnyConfectPublicQuery>(
  family: ContentSnapshotFamily,
  ref: Query,
  ...rest: Ref.OptionalArgs<Query>
) {
  return yield* readContentStore({ ...queryRead(ref, rest), scope: family });
});
