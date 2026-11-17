import { Effect, Exit, Fiber, MutableRef } from "effect";
import { type AuthConvex, readAuthClient } from "@/lib/auth/client";
import { type AuthSession, readClientSession } from "@/lib/auth/session";
import { sessionUser } from "@/lib/auth/user";

/** A session the page's readers follow: it reports each change to a listener until the listener is unsubscribed. */
export interface SessionFeed {
  readonly subscribe: (listener: (session: AuthSession) => void) => () => void;
}

/**
 * Reports the page's session to `listener` for as long as the scope lives. A
 * page whose browser holds no access token asks the refresh route once, which
 * answers from the refresh cookie, and reads as pending until it answers, so a
 * signed-in page never flashes signed out. A refresh that fails reads as a
 * failed read (`hasError`), never as a visitor.
 */
const reportSession = Effect.fn("www.auth.reportSession")(function* (
  convex: AuthConvex,
  listener: (session: AuthSession) => void
) {
  const client = yield* readAuthClient(convex);
  const primed = MutableRef.make(client.getAccessToken() !== null);
  const failed = MutableRef.make(false);
  const emit = () => {
    const snapshot = client.getSnapshot();
    listener(
      readClientSession(
        {
          hasError: MutableRef.get(failed),
          isLoading: snapshot.isLoading || !MutableRef.get(primed),
          token: snapshot.token,
        },
        sessionUser.getState().user
      )
    );
  };
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      const offClient = client.subscribe(emit);
      const offUser = sessionUser.subscribe(emit);
      emit();
      return () => {
        offClient();
        offUser();
      };
    }),
    (release) => Effect.sync(release)
  );
  if (!MutableRef.get(primed)) {
    const refreshed = yield* Effect.exit(
      Effect.tryPromise(() =>
        client.fetchAccessToken({ forceRefreshToken: true })
      )
    );
    MutableRef.set(primed, true);
    MutableRef.set(failed, Exit.isFailure(refreshed));
    emit();
  }
  return yield* Effect.never;
}, Effect.scoped);

/** The page's session as Convex Auth's client settles it, for the session stores to follow. */
export function followClientSession(convex: AuthConvex): SessionFeed {
  return {
    subscribe: (listener) => {
      const fiber = Effect.runFork(reportSession(convex, listener));
      return () => {
        Effect.runFork(Fiber.interrupt(fiber));
      };
    },
  };
}
