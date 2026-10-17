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
 * 19 to 35). A reader reads Convex's cached answer while it renders
 * (`convex/dist/esm/react/queries_observer.js`, lines 54 to 78), and Convex keeps
 * the last answer of a query after its last subscriber leaves, until the server
 * answers again (`convex/dist/esm/browser/sync/local_state.js`, lines 261 to 285,
 * and `optimistic_updates_impl.js`, lines 91 to 109). So a reader that mounts
 * again reads the failure it had and throws before it subscribes, and nothing
 * asks the server. A subscription to a query that already has subscribers asks
 * nothing either (`local_state.js`, lines 38 to 48), so this wait answers only
 * when no reader holds the query.
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
