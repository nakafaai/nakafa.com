"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { Data, Effect } from "effect";
import { type ReactNode, useRef } from "react";
import { AuthSessionProvider, useAuthSession } from "@/components/auth/session";
import { authClient } from "@/lib/auth/client";

let sharedConvexClient: ConvexReactClient | undefined;

/** Returns the one page-lifetime Convex client recommended by the React API. */
function getSharedConvexClient(convexUrl: string) {
  sharedConvexClient ??= new ConvexReactClient(convexUrl, {
    initialAuthTokenReuse: true,
    logger: false,
  });
  return sharedConvexClient;
}

/** A Better Auth token request could not produce a usable Convex credential. */
class ConvexTokenReadError extends Data.TaggedError("ConvexTokenReadError")<{
  readonly detail: string;
}> {}

/** Reads a fresh Convex JWT through the installed Better Auth client plugin. */
const readConvexToken = Effect.fn("NakafaAuth.readConvexToken")(function* () {
  const response = yield* Effect.tryPromise({
    catch: () =>
      new ConvexTokenReadError({
        detail: "Better Auth could not read a Convex access token.",
      }),
    try: () =>
      authClient.convex.token({
        fetchOptions: { throw: false },
      }),
  });
  if (response.error) {
    return yield* new ConvexTokenReadError({
      detail: "Better Auth rejected the Convex access token request.",
    });
  }
  return response.data?.token ?? null;
});

/**
 * Adapts Nakafa's Better Auth client to Convex's custom-auth contract.
 *
 * This follows the token lifecycle implemented by the installed integration.
 * Guide: https://labs.convex.dev/better-auth/framework-guides/next
 * Source: https://github.com/get-convex/better-auth/blob/v0.12.5/src/react/index.tsx#L53-L171
 *
 * Convex calls this hook itself through the `useAuth` prop and re-registers
 * authentication whenever the returned `fetchAccessToken` identity changes,
 * so the closure below intentionally captures only the session id. The React
 * Compiler memoizes it on that key; no manual memoization is needed.
 * https://docs.convex.dev/api/modules/react#convexproviderwithauth
 */
function useBetterAuth() {
  const { data: session, isPending } = useAuthSession();
  const sessionId = session?.session?.id;
  const cachedTokenRef = useRef<{
    readonly sessionId: string;
    readonly token: string;
  } | null>(null);
  const pendingTokenRef = useRef<{
    readonly promise: Promise<string | null>;
    readonly requestId: symbol;
    readonly sessionId: string;
  } | null>(null);

  const fetchAccessToken = ({
    forceRefreshToken,
  }: {
    forceRefreshToken: boolean;
  }) => {
    const cachedToken = cachedTokenRef.current;
    if (
      sessionId &&
      cachedToken?.sessionId === sessionId &&
      !forceRefreshToken
    ) {
      return Promise.resolve(cachedToken.token);
    }
    const existingRequest = pendingTokenRef.current;
    if (
      sessionId &&
      existingRequest &&
      existingRequest.sessionId === sessionId &&
      !forceRefreshToken
    ) {
      return existingRequest.promise;
    }
    if (!sessionId) {
      return Promise.resolve(null);
    }
    const requestId = Symbol("convex-token-request");
    const request = readConvexToken().pipe(
      Effect.catchTag("ConvexTokenReadError", () => Effect.succeed(null)),
      Effect.tap((token) =>
        Effect.sync(() => {
          if (pendingTokenRef.current?.requestId !== requestId) {
            return;
          }
          cachedTokenRef.current = token ? { sessionId, token } : null;
        })
      ),
      Effect.ensuring(
        Effect.sync(() => {
          if (pendingTokenRef.current?.requestId === requestId) {
            pendingTokenRef.current = null;
          }
        })
      )
    );
    const pending = Effect.runPromise(request);
    pendingTokenRef.current = { promise: pending, requestId, sessionId };
    return pending;
  };

  return {
    fetchAccessToken,
    isAuthenticated: sessionId !== undefined,
    isLoading: isPending,
  };
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
      <ConvexProviderWithAuth client={convex} useAuth={useBetterAuth}>
        {children}
      </ConvexProviderWithAuth>
    </AuthSessionProvider>
  );
}
