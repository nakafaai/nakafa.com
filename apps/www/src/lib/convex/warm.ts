import { Ref } from "@confect/core";
import type { ConvexReactClient } from "convex/react";
import { Deferred, Duration, Effect, Option } from "effect";
import { readMadeClient } from "@/lib/convex/client";

/**
 * How long a warmed read stays subscribed: as long as the router keeps an intent preload fresh
 * (`defaultPreloadStaleTime` in `router.tsx`), so the press the preload was made for finds the answer.
 */
export const WARM_HOLD = Duration.seconds(30);

/** Whether a watched query holds its answer: a value, or a failure, which Convex throws when it is read. */
const holdsAnswer = (watch: ReturnType<ConvexReactClient["watchQuery"]>) =>
  Effect.try(() => watch.localQueryResult() !== undefined).pipe(
    Effect.orElseSucceed(() => true)
  );

/** The watched query's local value once present, or none when it has not answered or failed. */
const readAnswer = (watch: ReturnType<ConvexReactClient["watchQuery"]>) =>
  Effect.try(() => Option.fromUndefinedOr(watch.localQueryResult())).pipe(
    Effect.orElseSucceed(() => Option.none())
  );

/**
 * Subscribes to one query on the page's Convex client ahead of the page that reads it, and ends once the query
 * holds its answer, a value or a refusal, returning the raw value when present. The subscription stays open for
 * `WARM_HOLD`, so a reader that mounts in that time reads the answer in its first render
 * (`convex/dist/esm/react/queries_observer.js`) and the page paints whole. A route's loader runs it after a press or
 * an intent preload, and the router keeps the old page until it ends. A query another reader already holds ends at
 * once. A visitor's page made no client, so it warms nothing and opens no socket. The client holds the query until
 * the session's token is known, so a warmed answer is never a signed-out one.
 */
export const warmQuery = Effect.fn("www.convex.warmQuery")(function* <
  Query extends Ref.AnyPublicQuery,
>(ref: Query, args: Ref.Args<Query>): Effect.fn.Return<Option.Option<unknown>> {
  const client = readMadeClient();
  if (Option.isNone(client)) {
    return Option.none();
  }
  const answered = yield* Deferred.make<void>();
  const watch = client.value.watchQuery(
    Ref.getFunctionReference(ref),
    Ref.encodeArgsSync(ref, args)
  );
  const unsubscribe = watch.onUpdate(() => {
    Deferred.doneUnsafe(answered, Effect.void);
  });
  yield* Effect.sleep(WARM_HOLD).pipe(
    Effect.andThen(Effect.sync(unsubscribe)),
    Effect.forkDetach({ startImmediately: true })
  );
  if (yield* holdsAnswer(watch)) {
    return yield* readAnswer(watch);
  }
  yield* Deferred.await(answered);
  return yield* readAnswer(watch);
});
