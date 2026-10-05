"use client";

import {
  ConvexProvider as ConvexClientProvider,
  ConvexReactClient,
} from "convex/react";
import { Effect, Exit, Option, Scope } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AuthSessionProvider,
  useAuthSession,
  useAuthSessionStore,
} from "@/components/auth/session";
import { authClient } from "@/lib/auth/client";
import {
  authenticateConvex,
  type ConvexAuth,
  type ConvexAuthStore,
  ConvexTokenReadError,
  createConvexAuthStore,
  readConvexAuth,
  readConvexSessionId,
} from "@/lib/auth/convex";

let sharedConvexClient: ConvexReactClient | undefined;

/** Returns the one page-lifetime Convex client recommended by the React API. */
function getSharedConvexClient(convexUrl: string) {
  sharedConvexClient ??= new ConvexReactClient(convexUrl, {
    initialAuthTokenReuse: true,
    logger: false,
  });
  return sharedConvexClient;
}

/**
 * Reads a fresh Convex JWT through the installed Better Auth client plugin.
 * https://labs.convex.dev/better-auth/framework-guides/next
 */
const readConvexToken = Effect.tryPromise({
  catch: () =>
    new ConvexTokenReadError({
      detail: "Better Auth could not read a Convex access token.",
    }),
  try: () => authClient.convex.token({ fetchOptions: { throw: false } }),
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

const ConvexAuthContext = createContext<ConvexAuthStore | null>(null);

/**
 * Hands Convex the signed-in session's credentials. It renders before the
 * provider's children, so its effect runs before theirs and a known session
 * authenticates the client before any child subscribes to a query, as the
 * first child of `ConvexProviderWithAuth` does.
 */
function ConvexSessionCredentials({
  client,
  store,
}: {
  client: ConvexReactClient;
  store: ConvexAuthStore;
}) {
  const sessionId = useAuthSession(readConvexSessionId);

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
 * Clears Convex's credentials when the signed-in session ends. Like the last
 * child of `ConvexProviderWithAuth`, it renders after the provider's children,
 * so its cleanup runs after theirs and readers that unmount with the session
 * release their queries before the credentials go.
 */
function ConvexSessionRelease({ client }: { client: ConvexReactClient }) {
  const sessionId = useAuthSession(readConvexSessionId);

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
  const convex = getSharedConvexClient(convexUrl);

  return (
    <AuthSessionProvider>
      <ConvexAuthProvider client={convex}>
        <ConvexClientProvider client={convex}>{children}</ConvexClientProvider>
      </ConvexAuthProvider>
    </AuthSessionProvider>
  );
}

/**
 * Selects one part of the Convex authentication state.
 *
 * The state is derived from the session and Convex's latest answer inside one
 * subscription to both stores, so a reader runs only when its selection
 * changes, and the server snapshot is the state the server rendered.
 */
export function useConvexAuth<T>(selector: (auth: ConvexAuth) => T) {
  const store = use(ConvexAuthContext);
  if (!store) {
    throw new TypeError("useConvexAuth must be used within ConvexProvider");
  }
  const session = useAuthSessionStore();

  return useSyncExternalStore(
    (onChange) => {
      const stopSession = session.subscribe(onChange);
      const stopStore = store.subscribe(onChange);
      return () => {
        stopSession();
        stopStore();
      };
    },
    () =>
      selector(
        readConvexAuth(session.getState(), store.getState().confirmation)
      ),
    () =>
      selector(
        readConvexAuth(
          session.getInitialState(),
          store.getInitialState().confirmation
        )
      )
  );
}
