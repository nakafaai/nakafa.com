import { getRequest } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { readSessionMemo } from "@/lib/auth/session.server";

/**
 * The Convex token of the request's visitor, or none for a visitor without a
 * session. It reads the request's session memo, so the page and its token share
 * one session read. Its failures stay typed, so a route answers them with its
 * error boundary instead of a signed-out view.
 */
export const readRequestToken = Effect.fn("www.tryout.route.readRequestToken")(
  function* () {
    const session = yield* Effect.flatten(readSessionMemo(getRequest()));
    return session.convexToken;
  }
);
