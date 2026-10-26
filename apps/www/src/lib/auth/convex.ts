import { NETWORK_RETRY_SCHEDULE } from "@repo/backend/client/network";
import type { ConvexReactClient } from "convex/react";
import {
  Cache,
  Duration,
  Effect,
  Exit,
  Match,
  MutableRef,
  Option,
  Predicate,
  Queue,
  Schema,
  Stream,
} from "effect";
import { createContext } from "react";
import { createStore } from "zustand";
import type { AuthSession } from "@/lib/auth/session";

/** Convex authentication as its readers see it. */
export const ConvexAuth = Schema.Struct({
  isAuthenticated: Schema.Boolean,
  isLoading: Schema.Boolean,
});

export type ConvexAuth = typeof ConvexAuth.Type;

/** Convex's answer to the credentials of one Better Auth session. */
export const ConvexAuthConfirmation = Schema.Struct({
  isAuthenticated: Schema.Boolean,
  sessionId: Schema.String,
});

export type ConvexAuthConfirmation = typeof ConvexAuthConfirmation.Type;

/**
 * Creates one provider's store of Convex's latest answer, empty as the server
 * renders it. Only `authenticateConvex` writes it.
 */
export function createConvexAuthStore() {
  return createStore(() => ({
    confirmation: Option.none<ConvexAuthConfirmation>(),
  }));
}

export type ConvexAuthStore = ReturnType<typeof createConvexAuthStore>;

/** Carries one page's Convex authentication store, which never changes after mount. */
export const ConvexAuthContext = createContext<ConvexAuthStore | null>(null);

/**
 * A Better Auth token request that produced no usable Convex credential.
 * `retryable` says whether asking again can answer otherwise: a request that
 * failed on its way or a server failure can, a refused session cannot.
 */
export class ConvexTokenReadError extends Schema.TaggedError<ConvexTokenReadError>()(
  "ConvexTokenReadError",
  { detail: Schema.String, retryable: Schema.Boolean }
) {}

/** The part of Convex's React client that authentication drives. */
type ConvexAuthClient = Pick<ConvexReactClient, "setAuth">;

/** Whom Convex authenticates, read from the Better Auth session. */
const ConvexAuthTarget = Schema.TaggedUnion({
  Pending: {},
  SignedIn: { sessionId: Schema.String },
  SignedOut: {},
});

type ConvexAuthTarget = typeof ConvexAuthTarget.Type;

const loadingConvexAuth = ConvexAuth.make({
  isAuthenticated: false,
  isLoading: true,
});

const authenticatedConvexAuth = ConvexAuth.make({
  isAuthenticated: true,
  isLoading: false,
});

const signedOutConvexAuth = ConvexAuth.make({
  isAuthenticated: false,
  isLoading: false,
});

function readTarget(session: AuthSession): ConvexAuthTarget {
  return Match.value(session).pipe(
    Match.when({ isPending: true }, () =>
      ConvexAuthTarget.cases.Pending.make({})
    ),
    Match.when({ sessionId: Predicate.isString }, ({ sessionId }) =>
      ConvexAuthTarget.cases.SignedIn.make({ sessionId })
    ),
    Match.orElse(() => ConvexAuthTarget.cases.SignedOut.make({}))
  );
}

/**
 * Returns the session whose credentials Convex should hold: the signed-in
 * session once Better Auth has settled on one, and `null` once it has settled
 * on none. While Better Auth has not answered yet, it is `known`, the session
 * the browser last had, so Convex asks for that session's token at once and
 * holds every function call until it has an answer. The cookie decides whom
 * the token names, so a session that turns out to be another one or none only
 * costs a second request.
 */
export function readConvexSessionId(
  session: AuthSession,
  known: string | null
) {
  return ConvexAuthTarget.match(readTarget(session), {
    Pending: () => known,
    SignedIn: ({ sessionId }) => sessionId,
    SignedOut: () => null,
  });
}

/** Whether Better Auth has settled on no session, so Convex holds no credentials. */
export function hasSettledSignedOut(session: AuthSession) {
  return ConvexAuthTarget.match(readTarget(session), {
    Pending: () => false,
    SignedIn: () => false,
    SignedOut: () => true,
  });
}

/** Convex's token request for a session that is none. */
const readNoToken = () => Promise.resolve(null);

/**
 * Lets the page's client send its calls without a token, once the session has
 * settled on none. The client holds every call until it has sent a token
 * (`readConvexClient`), and Convex resumes it when a token request answers
 * `null`, so a signed-out page's calls go out unauthenticated, as they did before
 * the hold.
 * https://docs.convex.dev/api/classes/react.ConvexReactClient#setauth
 */
export function releaseConvexAuth(client: ConvexAuthClient) {
  client.setAuth(readNoToken);
}

/**
 * Derives the Convex authentication a reader sees, the way
 * `ConvexProviderWithAuth` does while it renders: loading while the session is
 * pending or Convex has not confirmed it, signed out without a session, and
 * authenticated once Convex has confirmed this session's credentials.
 *
 * A signed-in session whose credentials Convex refused stays loading, so no
 * reader asks Convex as a visitor and shows the refusal of a page the learner
 * may open. `authenticateConvex` asks again when the reader comes back.
 *
 * Because the session decides it during render, every reader switches its
 * authenticated queries off in the same commit that ends a session.
 * https://github.com/get-convex/convex-js/blob/main/src/react/ConvexAuthState.tsx
 */
export function readConvexAuth(
  session: AuthSession,
  confirmation: Option.Option<ConvexAuthConfirmation>
) {
  return ConvexAuthTarget.match(readTarget(session), {
    Pending: () => loadingConvexAuth,
    SignedIn: ({ sessionId }) =>
      confirmation.pipe(
        Option.filter((answer) => answer.sessionId === sessionId),
        Option.match({
          onNone: () => loadingConvexAuth,
          onSome: ({ isAuthenticated }) =>
            isAuthenticated ? authenticatedConvexAuth : loadingConvexAuth,
        })
      ),
    SignedOut: () => signedOutConvexAuth,
  });
}

/**
 * Builds Convex's token fetcher for one session.
 *
 * Concurrent requests join the one read in flight, and its token is kept until
 * Convex asks for a fresh one. A read that fails retryably is tried again on the
 * shared network schedule. A failed read is kept for no time, so every request
 * waiting on it sees the failure and the next request reads again. Convex
 * receives `null` when no token can be read, as its contract requires.
 * https://docs.convex.dev/api/classes/react.ConvexReactClient#setauth
 */
const makeTokenFetcher = Effect.fnUntraced(function* (
  readToken: Effect.Effect<string, ConvexTokenReadError>,
  sessionId: string
) {
  const services = yield* Effect.context<never>();
  const read = readToken.pipe(
    Effect.retry({
      schedule: NETWORK_RETRY_SCHEDULE,
      while: (error) => error.retryable,
    })
  );
  const tokens = yield* Cache.makeWith(() => read, {
    capacity: 1,
    timeToLive: Exit.match({
      onFailure: () => Duration.zero,
      onSuccess: () => Duration.infinity,
    }),
  });
  return ({ forceRefreshToken }: { readonly forceRefreshToken: boolean }) =>
    Effect.runPromiseWith(services)(
      (forceRefreshToken
        ? Cache.invalidate(tokens, sessionId)
        : Effect.void
      ).pipe(
        Effect.andThen(Cache.get(tokens, sessionId)),
        Effect.catchTag("ConvexTokenReadError", () => Effect.succeed(null))
      )
    );
});

/**
 * Each time the reader comes back to the page, named by the event that brought
 * them: the tab shows again, or the network returns. Better Auth reads the
 * session again at the same moments. The tab's state is read when its event
 * fires, so a tab that was hidden again before the stream is read still counts
 * only when it showed.
 */
export const pageReturns = Stream.callback<string>((queue) => {
  const comeBack = (event: Event) => {
    Queue.offerUnsafe(queue, event.type);
  };
  const showAgain = (event: Event) => {
    if (document.visibilityState === "visible") {
      comeBack(event);
    }
  };
  return Effect.acquireRelease(
    Effect.sync(() => {
      document.addEventListener("visibilitychange", showAgain);
      window.addEventListener("online", comeBack);
    }),
    () =>
      Effect.sync(() => {
        document.removeEventListener("visibilitychange", showAgain);
        window.removeEventListener("online", comeBack);
      })
  );
});

/** Whether Convex refused the credentials of the session it last answered for. */
function isRefused(confirmation: Option.Option<ConvexAuthConfirmation>) {
  return Option.exists(confirmation, (answer) => !answer.isAuthenticated);
}

/**
 * Hands Convex the credentials of one signed-in session for the life of the
 * surrounding scope, and records Convex's answers in the provider's store.
 *
 * Convex asks for a token once more after a failed one and then gives up, so a
 * refused session is handed to Convex again each time `returns` emits.
 *
 * Closing the scope stops reporting and forgets the answer, so a session that
 * returns later waits for Convex again. It leaves Convex's credentials in
 * place: the provider clears them from its last child, as
 * `ConvexProviderWithAuth` does.
 */
export const authenticateConvex = Effect.fn("NakafaAuth.authenticateConvex")(
  function* ({
    client,
    readToken,
    returns,
    sessionId,
    store,
  }: {
    readonly client: ConvexAuthClient;
    readonly readToken: Effect.Effect<string, ConvexTokenReadError>;
    readonly returns: Stream.Stream<unknown>;
    readonly sessionId: string;
    readonly store: ConvexAuthStore;
  }) {
    const fetchToken = yield* makeTokenFetcher(readToken, sessionId);
    const isCurrent = MutableRef.make(true);
    const authenticate = () =>
      client.setAuth(fetchToken, (isAuthenticated) => {
        if (MutableRef.get(isCurrent)) {
          store.setState({
            confirmation: Option.some(
              ConvexAuthConfirmation.make({ isAuthenticated, sessionId })
            ),
          });
        }
      });
    yield* Effect.acquireRelease(Effect.sync(authenticate), () =>
      Effect.sync(() => {
        MutableRef.set(isCurrent, false);
        store.setState({ confirmation: Option.none() });
      })
    );
    yield* returns.pipe(
      Stream.filter(() => isRefused(store.getState().confirmation)),
      Stream.runForEach(() => Effect.sync(authenticate)),
      Effect.forkScoped
    );
  }
);
