import type { ConvexReactClient } from "convex/react";
import {
  Duration,
  Effect,
  Equal,
  Exit,
  Match,
  MutableRef,
  Predicate,
  Schema,
  Scope,
} from "effect";
import type { StoreApi } from "zustand";
import type { AuthSession } from "@/lib/auth/session";

/** Convex authentication as its readers see it. */
export const ConvexAuth = Schema.Struct({
  isAuthenticated: Schema.Boolean,
  isLoading: Schema.Boolean,
});

export type ConvexAuth = typeof ConvexAuth.Type;

/** A Better Auth token request that produced no usable Convex credential. */
export class ConvexTokenReadError extends Schema.TaggedError<ConvexTokenReadError>()(
  "ConvexTokenReadError",
  { detail: Schema.String }
) {}

/** The part of Convex's React client that authentication drives. */
type ConvexAuthClient = Pick<ConvexReactClient, "clearAuth" | "setAuth">;

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
 * Returns the Convex authentication a session starts with, before Convex has
 * answered: loading while a session is pending or awaits its token, settled
 * once the visitor is known to be signed out.
 */
export function readInitialConvexAuth(session: AuthSession) {
  return ConvexAuthTarget.match(readTarget(session), {
    Pending: () => loadingConvexAuth,
    SignedIn: () => loadingConvexAuth,
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
 * Keeps the Convex client authenticated as the current Better Auth session
 * and reports the result to the Convex authentication store.
 *
 * This follows the transitions of `ConvexProviderWithAuth`, whose context
 * changes would discard streamed Suspense boundaries during hydration: a
 * signed-in session binds a token fetcher in its own scope and waits for
 * Convex to confirm it, and closing that scope, when the session changes or
 * the binding stops, clears Convex's credentials and ignores the binding's
 * late confirmations.
 * https://github.com/get-convex/convex-js/blob/main/src/react/ConvexAuthState.tsx
 */
export const bindConvexAuth = Effect.fn("NakafaAuth.bindConvexAuth")(
  function* ({
    auth,
    client,
    readToken,
    session,
  }: {
    readonly auth: StoreApi<ConvexAuth>;
    readonly client: ConvexAuthClient;
    readonly readToken: Effect.Effect<string, ConvexTokenReadError>;
    readonly session: StoreApi<AuthSession>;
  }) {
    const services = yield* Effect.context<never>();
    const authenticate = Effect.fnUntraced(function* () {
      const fetchToken = yield* makeTokenFetcher(readToken);
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const isCurrent = MutableRef.make(true);
          auth.setState(loadingConvexAuth, true);
          client.setAuth(fetchToken, (isAuthenticated) => {
            if (MutableRef.get(isCurrent)) {
              auth.setState(
                ConvexAuth.make({ isAuthenticated, isLoading: false }),
                true
              );
            }
          });
          return isCurrent;
        }),
        (isCurrent) =>
          Effect.sync(() => {
            MutableRef.set(isCurrent, false);
            client.clearAuth();
          })
      );
    });
    const enter = (target: ConvexAuthTarget) =>
      ConvexAuthTarget.match(target, {
        Pending: () =>
          Effect.sync(() => auth.setState(loadingConvexAuth, true)),
        SignedIn: () => authenticate(),
        SignedOut: () =>
          Effect.sync(() => auth.setState(signedOutConvexAuth, true)),
      });
    const boundScope = MutableRef.make<Scope.Closeable>(yield* Scope.make());
    const boundTarget = MutableRef.make<ConvexAuthTarget>(
      ConvexAuthTarget.cases.Pending.make({})
    );
    const follow = Effect.fnUntraced(function* (state: AuthSession) {
      const target = readTarget(state);
      if (Equal.equals(MutableRef.get(boundTarget), target)) {
        return;
      }
      yield* Scope.close(MutableRef.get(boundScope), Exit.void);
      const scope = yield* Scope.make();
      MutableRef.set(boundScope, scope);
      MutableRef.set(boundTarget, target);
      yield* Scope.provide(enter(target), scope);
    });

    yield* Effect.acquireRelease(
      Effect.sync(() =>
        session.subscribe((state) => {
          Effect.runSyncWith(services)(follow(state));
        })
      ),
      (unsubscribe) =>
        Effect.suspend(() => {
          unsubscribe();
          return Scope.close(MutableRef.get(boundScope), Exit.void);
        })
    );
    yield* follow(session.getState());
    return yield* Effect.never;
  },
  Effect.scoped
);
