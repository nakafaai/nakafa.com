import type { ConvexReactClient } from "convex/react";
import { Duration, Effect, Schema } from "effect";

type ConvexConnectionState = ReturnType<ConvexReactClient["connectionState"]>;
type ConvexConnection = Pick<
  ConvexReactClient,
  "connectionState" | "subscribeToConnectionState"
>;

/**
 * How long a call waits for a socket that the client is opening or restoring.
 * The first connection, a session refresh, and a first reconnect usually end
 * within it, so a person who is online is rarely refused for them.
 */
const SOCKET_WAIT = Duration.seconds(5);

/** Raised before a Convex call starts while the client is offline, so the client never queues it. */
export class ConvexOfflineError extends Schema.TaggedError<ConvexOfflineError>()(
  "ConvexOfflineError",
  { message: Schema.String }
) {}

/**
 * Whether the client had a socket or tried to get one, and has none now. A
 * view shows this as offline. Before its first attempt the client is not
 * offline yet: it is still connecting.
 */
export function isConvexOffline(state: ConvexConnectionState) {
  const hadOrTriedConnection =
    state.connectionCount > 0 || state.connectionRetries > 0;
  return hadOrTriedConnection && !state.isWebSocketConnected;
}

/** Completes when the client has a connected socket: at once when it has one now. */
function socketConnected(convex: ConvexConnection) {
  return Effect.callback<void>((resume) => {
    if (convex.connectionState().isWebSocketConnected) {
      resume(Effect.void);
      return;
    }
    const unsubscribe = convex.subscribeToConnectionState((state) => {
      if (state.isWebSocketConnected) {
        unsubscribe();
        resume(Effect.void);
      }
    });
    return Effect.sync(unsubscribe);
  });
}

/**
 * Lets a Convex mutation or action start only on a connected socket. It
 * refuses at once when the browser reports no network, and after a short wait
 * when the client has no connected socket: a call that started then would be
 * stored and delivered when the socket opens. It reads the client at the
 * moment of the call, so the caller needs no subscription to the connection
 * state.
 */
export const requireConvexOnline = Effect.fn("www.convex.requireOnline")(
  function* (convex: ConvexConnection) {
    const refusal = new ConvexOfflineError({
      message: "Convex is offline, so the request was not started.",
    });
    if (navigator.onLine === false) {
      return yield* refusal;
    }
    yield* socketConnected(convex).pipe(
      Effect.timeoutOrElse({
        duration: SOCKET_WAIT,
        orElse: () => Effect.fail(refusal),
      })
    );
  }
);
