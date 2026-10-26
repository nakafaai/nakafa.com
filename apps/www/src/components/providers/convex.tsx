"use client";

import {
  ConvexProvider as ConvexClientProvider,
  type ConvexReactClient,
} from "convex/react";
import { Effect, Exit, Function as Fn, Option, Scope } from "effect";
import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { AuthSessionProvider } from "@/components/auth/follow";
import { useAuthSession } from "@/components/auth/session";
import { readAuthClient } from "@/lib/auth/client";
import {
  authenticateConvex,
  ConvexAuthContext,
  type ConvexAuthStore,
  ConvexTokenReadError,
  createConvexAuthStore,
  hasSettledSignedOut,
  readConvexSessionId,
  releaseConvexAuth,
} from "@/lib/auth/convex";
import { loadKnownSession, saveKnownSession } from "@/lib/auth/known";
import { readConvexClient } from "@/lib/convex/client";

/**
 * Reads a fresh Convex JWT through the installed Better Auth client plugin.
 * https://labs.convex.dev/better-auth/framework-guides/next
 */
const readConvexToken = Effect.tryPromise({
  catch: () =>
    new ConvexTokenReadError({
      detail: "Better Auth could not read a Convex access token.",
    }),
  try: () => readAuthClient().convex.token({ fetchOptions: { throw: false } }),
}).pipe(
  Effect.flatMap((response) =>
    response.error
      ? Effect.fail(
          new ConvexTokenReadError({
            detail: "Better Auth rejected the Convex access token request.",
          })
        )
      : Effect.fromOption(
          Option.fromNullishOr(response.data?.token),
          () =>
            new ConvexTokenReadError({
              detail: "Better Auth returned no Convex access token.",
            })
        )
  )
);

/** What the browser knows about its session never changes under a mounted page, so nothing notifies. */
function subscribeKnownSession() {
  return Fn.constVoid;
}

/** The session the browser last had, as its storage holds it. */
function readKnownSession() {
  return Effect.runSync(loadKnownSession());
}

/** The server knows no earlier session, and neither does the render that hydrates its HTML. */
function readNoSession() {
  return null;
}

/**
 * The session Convex holds credentials for: the signed-in session, and until
 * Better Auth has answered, the session the browser last had.
 */
function useConvexSessionId() {
  const known = useSyncExternalStore(
    subscribeKnownSession,
    readKnownSession,
    readNoSession
  );
  return useAuthSession((session) => readConvexSessionId(session, known));
}

/**
 * Hands Convex the session's credentials. It renders before the provider's
 * children, so its effect runs before theirs and a known session authenticates
 * the client before any child subscribes to a query, as the first child of
 * `ConvexProviderWithAuth` does. A session that settles on none releases the
 * client's hold on its calls. It also keeps what each settled session says for
 * the next page load.
 */
export function ConvexSessionCredentials({
  client,
  store,
}: {
  client: ConvexReactClient;
  store: ConvexAuthStore;
}) {
  const sessionId = useConvexSessionId();
  const session = useAuthSession(Fn.identity);
  const isSignedOut = useAuthSession(hasSettledSignedOut);

  useEffect(() => {
    Effect.runSync(saveKnownSession(session));
  }, [session]);

  useEffect(() => {
    if (isSignedOut) {
      releaseConvexAuth(client);
    }
  }, [client, isSignedOut]);

  useEffect(() => {
    if (sessionId === null) {
      return;
    }
    const scope = Scope.makeUnsafe();
    Effect.runSync(
      Scope.provide(
        authenticateConvex({
          client,
          readToken: readConvexToken,
          sessionId,
          store,
        }),
        scope
      )
    );
    return () => {
      Effect.runSync(Scope.close(scope, Exit.void));
    };
  }, [client, sessionId, store]);

  return null;
}

/**
 * Clears Convex's credentials when the session ends. Like the last child of
 * `ConvexProviderWithAuth`, it renders after the provider's children, so its
 * cleanup runs after theirs and readers that unmount with the session release
 * their queries before the credentials go.
 */
export function ConvexSessionRelease({
  client,
}: {
  client: ConvexReactClient;
}) {
  const sessionId = useConvexSessionId();

  useEffect(() => {
    if (sessionId === null) {
      return;
    }
    return () => {
      client.clearAuth();
    };
  }, [client, sessionId]);

  return null;
}

/**
 * Keeps the Convex client authenticated as the Better Auth session.
 *
 * Convex's `ConvexProviderWithAuth` shares its state through a context whose
 * value changes when the session resolves, and React client-renders every
 * streamed Suspense boundary that is still pending at that moment. This
 * provider keeps Convex's answers in a store created once per provider, so the
 * context value never changes, and readers derive their state from it and the
 * session store, hydrating with the server's state.
 * https://docs.convex.dev/auth/advanced/custom-auth
 */
function ConvexAuthProvider({
  children,
  client,
}: {
  children: ReactNode;
  client: ConvexReactClient;
}) {
  const [store] = useState(() => createConvexAuthStore());

  return (
    <ConvexAuthContext value={store}>
      <ConvexSessionCredentials client={client} store={store} />
      {children}
      <ConvexSessionRelease client={client} />
    </ConvexAuthContext>
  );
}

/**
 * Provides one shared Convex client authenticated by Nakafa's Better Auth session.
 */
export function ConvexProvider({
  children,
  convexUrl,
}: {
  children: ReactNode;
  convexUrl: string;
}) {
  const convex = readConvexClient(convexUrl);

  return (
    <AuthSessionProvider>
      <ConvexAuthProvider client={convex}>
        <ConvexClientProvider client={convex}>{children}</ConvexClientProvider>
      </ConvexAuthProvider>
    </AuthSessionProvider>
  );
}
