"use client";

import {
  ConvexProvider as ConvexClientProvider,
  ConvexReactClient,
} from "convex/react";
import { Effect, Fiber, Option } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import {
  AuthSessionProvider,
  useAuthSessionStore,
} from "@/components/auth/session";
import { authClient } from "@/lib/auth/client";
import {
  bindConvexAuth,
  type ConvexAuth,
  ConvexTokenReadError,
  readInitialConvexAuth,
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

const ConvexAuthContext = createContext<StoreApi<ConvexAuth> | null>(null);

/**
 * Binds the Convex client to the Better Auth session for its provider.
 *
 * It renders before the provider's children, so its effect runs before
 * theirs: a session that is already known authenticates the client before any
 * child subscribes to a query, as `ConvexProviderWithAuth` does.
 */
function ConvexAuthBinding({
  auth,
  client,
  session,
}: {
  auth: StoreApi<ConvexAuth>;
  client: ConvexReactClient;
  session: ReturnType<typeof useAuthSessionStore>;
}) {
  useEffect(() => {
    const binding = Effect.runFork(
      bindConvexAuth({ auth, client, readToken: readConvexToken, session })
    );
    return () => {
      Effect.runFork(Fiber.interrupt(binding));
    };
  }, [auth, client, session]);

  return null;
}

/**
 * Keeps the Convex client authenticated as the Better Auth session.
 *
 * Convex's `ConvexProviderWithAuth` shares its state through a context whose
 * value changes when the session resolves, and React client-renders every
 * streamed Suspense boundary that is still pending at that moment. This
 * provider keeps that state in a store created once per provider, so the
 * context value never changes and readers hydrate with the server's state.
 * https://docs.convex.dev/auth/advanced/custom-auth
 */
function ConvexAuthProvider({
  children,
  client,
}: {
  children: ReactNode;
  client: ConvexReactClient;
}) {
  const session = useAuthSessionStore();
  const [store] = useState(() =>
    createStore(() => readInitialConvexAuth(session.getState()))
  );

  return (
    <ConvexAuthContext value={store}>
      <ConvexAuthBinding auth={store} client={client} session={session} />
      {children}
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

/** Selects one part of the Convex authentication state. */
export function useConvexAuth<T>(selector: (auth: ConvexAuth) => T) {
  const store = use(ConvexAuthContext);
  if (!store) {
    throw new TypeError("useConvexAuth must be used within ConvexProvider");
  }
  return useStore(store, selector);
}
