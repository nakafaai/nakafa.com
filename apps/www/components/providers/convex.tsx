"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { Effect, Schema } from "effect";
import { type ReactNode, useCallback, useRef } from "react";
import { env } from "@/env";
import { authClient } from "@/lib/auth/client";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL, {
  initialAuthTokenReuse: true,
  verbose: false,
});

/** A Better Auth token request could not produce a usable Convex credential. */
class ConvexTokenReadError extends Schema.TaggedError<ConvexTokenReadError>()(
  "ConvexTokenReadError",
  { detail: Schema.String }
) {}

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

/** Adapts Nakafa's typed Better Auth client to Convex's custom-auth contract. */
function useBetterAuth() {
  const { data: session, isPending } = authClient.useSession();
  const sessionId = session?.session.id;
  const cachedTokenRef = useRef<{
    readonly sessionId: string;
    readonly token: string;
  } | null>(null);
  const pendingTokenRef = useRef<{
    readonly promise: Promise<string | null>;
    readonly requestId: symbol;
    readonly sessionId: string;
  } | null>(null);

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization -- Convex resets auth whenever this callback identity changes.
  const fetchAccessToken = useCallback(
    ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
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
        existingRequest.sessionId === sessionId
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
    },
    [sessionId]
  );

  return {
    fetchAccessToken,
    isAuthenticated: sessionId !== undefined,
    isLoading: isPending,
  };
}

/** Provides one shared Convex client authenticated by Nakafa's Better Auth session. */
export function ConvexProvider({ children }: { children: ReactNode }) {
  "use no memo";
  // Convex custom auth requires passing the adapter Hook to its provider.
  // https://docs.convex.dev/auth/advanced/custom-auth#client-side-integration

  return (
    // react-doctor-disable-next-line react-hooks-js/hooks -- Convex requires the auth Hook as a provider prop.
    <ConvexProviderWithAuth client={convex} useAuth={useBetterAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
