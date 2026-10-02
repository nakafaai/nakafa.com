import type { ConvexReactClient } from "convex/react";
import {
  Duration,
  Effect,
  Match,
  MutableRef,
  Option,
  Predicate,
  Schema,
} from "effect";
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

/** A Better Auth token request that produced no usable Convex credential. */
export class ConvexTokenReadError extends Schema.TaggedError<ConvexTokenReadError>()(
  "ConvexTokenReadError",
  { detail: Schema.String }
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
 * session once Better Auth has settled on one, `null` while the session is
 * pending or signed out.
 */
export function readConvexSessionId(session: AuthSession) {
  return ConvexAuthTarget.match(readTarget(session), {
    Pending: () => null,
    SignedIn: ({ sessionId }) => sessionId,
    SignedOut: () => null,
  });
}

/**
 * Derives the Convex authentication a reader sees, the way
 * `ConvexProviderWithAuth` does while it renders: loading while the session is
 * pending or Convex has not answered for it, signed out without a session, and
 * Convex's answer once it has confirmed this session's credentials.
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
            ConvexAuth.make({ isAuthenticated, isLoading: false }),
        })
      ),
    SignedOut: () => signedOutConvexAuth,
  });
}

/**
 * Builds Convex's token fetcher for one session.
 *
 * Concurrent requests share the first token, which is kept until Convex asks
 * for a fresh one; a failed request is dropped, so the next call retries it.
 * Convex receives `null` when no token can be read, as its contract requires.
 * https://docs.convex.dev/api/classes/react.ConvexReactClient#setauth
 */
const makeTokenFetcher = Effect.fnUntraced(function* (
  readToken: Effect.Effect<string, ConvexTokenReadError>
) {
  const services = yield* Effect.context<never>();
  const [token, invalidate] = yield* Effect.cachedInvalidateWithTTL(
    readToken,
    Duration.infinity
  );
  return ({ forceRefreshToken }: { readonly forceRefreshToken: boolean }) =>
    Effect.runPromiseWith(services)(
      (forceRefreshToken ? invalidate : Effect.void).pipe(
        Effect.andThen(token),
        Effect.tapError(() => invalidate),
        Effect.catchTag("ConvexTokenReadError", () => Effect.succeed(null))
      )
    );
});

/**
 * Hands Convex the credentials of one signed-in session for the life of the
 * surrounding scope, and records Convex's answers in the provider's store.
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
    sessionId,
    store,
  }: {
    readonly client: ConvexAuthClient;
    readonly readToken: Effect.Effect<string, ConvexTokenReadError>;
    readonly sessionId: string;
    readonly store: ConvexAuthStore;
  }) {
    const fetchToken = yield* makeTokenFetcher(readToken);
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const isCurrent = MutableRef.make(true);
        client.setAuth(fetchToken, (isAuthenticated) => {
          if (MutableRef.get(isCurrent)) {
            store.setState({
              confirmation: Option.some(
                ConvexAuthConfirmation.make({ isAuthenticated, sessionId })
              ),
            });
          }
        });
        return isCurrent;
      }),
      (isCurrent) =>
        Effect.sync(() => {
          MutableRef.set(isCurrent, false);
          store.setState({ confirmation: Option.none() });
        })
    );
  }
);
