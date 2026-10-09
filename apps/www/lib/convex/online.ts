import type { ConvexReactClient } from "convex/react";
import { Duration, Effect, Schema } from "effect";

type ConvexConnectionState = ReturnType<ConvexReactClient["connectionState"]>;
type ConvexConnection = Pick<
  ConvexReactClient,
  "connectionState" | "subscribeToConnectionState"
>;

/**
 * How long a call waits for a socket that the client is restoring. A session
 * refresh and a first reconnect take under two seconds, so a person who is
 * online is never refused for them.
 */
const SOCKET_WAIT = Duration.seconds(5);

/** Raised before a Convex call starts while the client is offline, so the client never queues it. */
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

/** Completes when the client has a socket: at once when it has one now. */
function socketRestored(convex: ConvexConnection) {
  return Effect.callback<void>((resume) => {
    if (!isConvexOffline(convex.connectionState())) {
      resume(Effect.void);
      return;
    }
    const unsubscribe = convex.subscribeToConnectionState((state) => {
      if (!isConvexOffline(state)) {
        unsubscribe();
        resume(Effect.void);
      }
    });
    return Effect.sync(unsubscribe);
  });
}

/**
 * Lets a Convex mutation or action start only while the client is online. It
 * refuses at once when the browser reports no network, and after a short wait
 * when the client has no socket: a call that started then would be stored and
 * delivered after the reconnect. It reads the client at the moment of the
 * call, so the caller needs no subscription to the connection state.
 */
export const requireConvexOnline = Effect.fn("www.convex.requireOnline")(
  function* (convex: ConvexConnection) {
    const refusal = new ConvexOfflineError({
      message: "Convex is offline, so the request was not started.",
    });
    if (navigator.onLine === false) {
      return yield* refusal;
    }
    yield* socketRestored(convex).pipe(
      Effect.timeoutOrElse({
        duration: SOCKET_WAIT,
        orElse: () => Effect.fail(refusal),
      })
    );
  }
);
