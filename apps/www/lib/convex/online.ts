import type { useConvexConnectionState } from "convex/react";
import { Effect, Schema } from "effect";

type ConvexConnectionState = ReturnType<typeof useConvexConnectionState>;

/** Raised before a Convex call starts while the socket is down, so the client never queues it. */
export class ConvexOfflineError extends Schema.TaggedError<ConvexOfflineError>()(
  "ConvexOfflineError",
  { message: Schema.String }
) {}

/**
 * Whether the client had a socket or tried to get one, and has none now. Before
 * its first attempt the client is not offline: a call then waits for the handshake.
 */
export function isConvexOffline(state: ConvexConnectionState) {
  const hadOrTriedConnection =
    state.connectionCount > 0 || state.connectionRetries > 0;
  return hadOrTriedConnection && !state.isWebSocketConnected;
}

/** Refuses a Convex mutation or action before it starts while the socket is down. */
export const requireConvexOnline = Effect.fn("www.convex.requireOnline")(
  function* (state: ConvexConnectionState) {
    if (isConvexOffline(state)) {
      return yield* new ConvexOfflineError({
        message: "Convex is offline, so the request was not started.",
      });
    }
  }
);
