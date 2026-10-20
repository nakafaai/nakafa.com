import { Effect } from "effect";
import { EXPECTED_SESSION, KNOWN_SESSION_KEY } from "@/lib/auth/keys";
import type { AuthSession } from "@/lib/auth/session";

type KnownSessionStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

/**
 * Runs one call on the storage: the given one, or the browser's. It fails
 * where the browser refuses its storage or the call, as with storage turned
 * off.
 */
function withStorage<A>(
  storage: KnownSessionStorage | undefined,
  use: (target: KnownSessionStorage) => A
) {
  return Effect.try(() => use(storage ?? window.localStorage));
}

/**
 * Reads the session the browser last had, or null when it had none or its
 * storage cannot be read. The id names a session and is no credential: only
 * the session cookie, which scripts cannot read, signs a request.
 *
 * Better Auth answers for the session one request after the page loads. With
 * this id Convex asks for its token at once instead of after that answer, and
 * holds every function call until it has one, so a change the learner makes
 * in that moment is sent signed in.
 */
export const loadKnownSession = Effect.fn("www.auth.loadKnownSession")(
  function* (storage?: KnownSessionStorage) {
    return yield* withStorage(storage, (target) =>
      target.getItem(KNOWN_SESSION_KEY)
    ).pipe(Effect.orElseSucceed(() => null));
  }
);

/**
 * Keeps what a settled session says: its id while signed in, nothing once
 * Better Auth says the browser is signed out. A pending session and a session
 * request that failed say nothing, so what the browser knew stays.
 */
export const saveKnownSession = Effect.fn("www.auth.saveKnownSession")(
  function* (session: AuthSession, storage?: KnownSessionStorage) {
    if (session.isPending || session.hasError) {
      return;
    }
    const { sessionId } = session;
    yield* withStorage(storage, (target) =>
      sessionId === null
        ? target.removeItem(KNOWN_SESSION_KEY)
        : target.setItem(KNOWN_SESSION_KEY, sessionId)
    ).pipe(Effect.ignore);
  }
);

/**
 * Notes that a sign-in is on its way, so the page it returns to asks Convex
 * for a token at once too, although the browser has never seen that session.
 */
export const expectSession = Effect.fn("www.auth.expectSession")(function* (
  storage?: KnownSessionStorage
) {
  yield* withStorage(storage, (target) =>
    target.setItem(KNOWN_SESSION_KEY, EXPECTED_SESSION)
  ).pipe(Effect.ignore);
});
