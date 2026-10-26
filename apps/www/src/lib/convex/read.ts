import { Ref } from "@confect/core";
import { Effect } from "effect";
import { clientEnv } from "@/env.public";
import { readConvexClient } from "@/lib/convex/client";

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
