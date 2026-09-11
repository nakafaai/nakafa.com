"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { type ReactNode, useCallback, useRef } from "react";
import { AuthSessionProvider, useAuthSession } from "@/components/auth/session";
import { env } from "@/env";
import { authClient } from "@/lib/auth/client";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

/**
 * Adapts Nakafa's Better Auth session to Convex's custom-auth contract.
 *
 * This follows the token lifecycle implemented by the installed integration.
 * Guide: https://labs.convex.dev/better-auth/framework-guides/next
 * Source: https://github.com/get-convex/better-auth/blob/v0.12.5/src/react/index.tsx#L53-L171
 */
function useBetterAuth() {
  const { data: session, isPending } = useAuthSession();
  const sessionId = session?.session?.id;
  const cachedTokenRef = useRef<{
    readonly sessionId: string;
    readonly token: string;
  } | null>(null);
  const pendingTokenRef = useRef<Promise<string | null> | null>(null);

  // Convex reloads auth when this callback identity changes.
  // https://docs.convex.dev/api/modules/react#convexproviderwithauth
  // https://github.com/get-convex/convex-js/blob/d28852aa028dede94796a012a2a802ae6ad04188/src/react/ConvexAuthState.tsx#L75-L80
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization
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
      if (sessionId && pendingTokenRef.current && !forceRefreshToken) {
        return pendingTokenRef.current;
      }
      if (!sessionId) {
        return Promise.resolve(null);
      }
      const pending = authClient.convex
        .token({ fetchOptions: { throw: false } })
        .then(({ data }) => {
          const token = data?.token ?? null;
          cachedTokenRef.current = token ? { sessionId, token } : null;
          return token;
        })
        .catch(() => {
          cachedTokenRef.current = null;
          return null;
        })
        .finally(() => {
          pendingTokenRef.current = null;
        });
      pendingTokenRef.current = pending;
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

/**
 * Provides one shared Convex client authenticated by Nakafa's Better Auth session.
 */
export function ConvexProvider({ children }: { children: ReactNode }) {
  return (
    <AuthSessionProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useBetterAuth}>
        {children}
      </ConvexProviderWithAuth>
    </AuthSessionProvider>
  );
}
