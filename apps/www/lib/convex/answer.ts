import { Ref } from "@confect/core";
import type { ConvexReactClient } from "convex/react";
import { Deferred, Effect } from "effect";

/**
 * Subscribes to one query and ends on the first update of that subscription,
 * which is the server's answer: a value or a failure. The subscription lives in
 * the caller's scope, so the caller decides when it ends, and an interruption
 * that closes the scope releases it too.
 *
 * Confect cannot do this, because of three facts in the installed Convex 1.47.0
 * and Confect 10.2.0 packages. A reader's `useQuery` rethrows a failure that the
 * query does not declare while it renders (`@confect/react/dist/index.js`, lines
 * 27 to 33). A reader reads Convex's cached answer while it renders
 * (`convex/dist/esm/react/queries_observer.js`, lines 54 to 78). When the last
 * subscriber of a query leaves, Convex drops the subscription and keeps the
 * cached answer (`convex/dist/esm/browser/sync/local_state.js`, lines 267 to
 * 268). The next server transition, or the response to a failed mutation,
 * replaces the cache with the answers of the queries that still have
 * subscribers (`convex/dist/esm/browser/sync/client.js`, lines 215 to 240 and
 * 301 to 318, and `optimistic_updates_impl.js`, lines 96 and 102 to 107). So
 * until one of those messages arrives, a reader that mounts again reads the
 * failure it had and throws before it subscribes, and nothing asks the server.
 * A subscription to a query that already has subscribers asks nothing either
 * (`local_state.js`, lines 38 to 48), so this wait asks the server only when no
 * reader holds the query.
 */
export const awaitServerAnswer = Effect.fn("www.convex.awaitServerAnswer")(
  function* <Query extends Ref.AnyPublicQuery>(
    convex: Pick<ConvexReactClient, "watchQuery">,
    ref: Query,
    args: Ref.Args<Query>
  ) {
    const answered = yield* Deferred.make<void>();
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        convex
          .watchQuery(
            Ref.getFunctionReference(ref),
            Ref.encodeArgsSync(ref, args)
          )
          .onUpdate(() => {
            Deferred.doneUnsafe(answered, Effect.void);
          })
      ),
      (unsubscribe) => Effect.sync(unsubscribe)
    );
    yield* Deferred.await(answered);
  }
);
