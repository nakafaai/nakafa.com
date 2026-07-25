"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { Effect, Schema } from "effect";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { env } from "@/env";
import { authClient } from "@/lib/auth/client";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL, {
  verbose: false,
});
const InitialTokenContext = createContext<string | null>(null);

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
  const initialToken = useContext(InitialTokenContext);
  const { data: session, isPending } = authClient.useSession();
  const initialTokenRef = useRef(initialToken);
  const pendingTokenRef = useRef<{
    readonly promise: Promise<string | null>;
    readonly sessionId: string | undefined;
  } | null>(null);
  const [hasInitialToken, setHasInitialToken] = useState(initialToken !== null);
  const sessionId = session?.session.id;

  useEffect(() => {
    if (isPending || !hasInitialToken) {
      return;
    }
    initialTokenRef.current = null;
    setHasInitialToken(false);
  }, [hasInitialToken, isPending]);

  const fetchAccessToken = useCallback(
    ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const initial = initialTokenRef.current;
      initialTokenRef.current = null;
      if (initial && !forceRefreshToken) {
        return Promise.resolve(initial);
      }
      const existingRequest = pendingTokenRef.current;
      if (existingRequest && existingRequest.sessionId === sessionId) {
        return existingRequest.promise;
      }
      const request = readConvexToken().pipe(
        Effect.catchTag("ConvexTokenReadError", () => Effect.succeed(null)),
        Effect.ensuring(
          Effect.sync(() => {
            if (pendingTokenRef.current?.sessionId === sessionId) {
              pendingTokenRef.current = null;
            }
          })
        )
      );
      const pending = Effect.runPromise(request);
      pendingTokenRef.current = { promise: pending, sessionId };
      return pending;
    },
    [sessionId]
  );

  return useMemo(
    () => ({
      fetchAccessToken,
      isAuthenticated: Boolean(session?.session) || hasInitialToken,
      isLoading: isPending && !hasInitialToken,
    }),
    [fetchAccessToken, hasInitialToken, isPending, session?.session]
  );
}

/** Provides one shared Convex client authenticated by Nakafa's Better Auth session. */
export function ConvexProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  return (
    <InitialTokenContext.Provider value={initialToken ?? null}>
      <ConvexProviderWithAuth client={convex} useAuth={useBetterAuth}>
        {children}
      </ConvexProviderWithAuth>
    </InitialTokenContext.Provider>
  );
}
