"use client";

import { createContext, type ReactNode, use, useDeferredValue } from "react";
import { env } from "@/env";
import { authClient } from "@/lib/auth/client";

type AuthSession = Pick<
  ReturnType<typeof authClient.useSession>,
  "data" | "error" | "isPending"
>;

const AuthSessionContext = createContext<AuthSession | null>(null);
const previewSession = {
  data: null,
  error: null,
  isPending: false,
} satisfies AuthSession;

/**
 * Reads the live session once for all app authentication consumers. The
 * session settles while a streamed page may still be hydrating. A signed-out
 * result is read deferred, so React applies it in a transition and finishes
 * hydrating the page first instead of discarding the page's server HTML. A
 * signed-in result applies at once: Convex authenticates only after it
 * commits, and a transition would wait on surfaces that need that.
 */
function BetterAuthSessionProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const settled = useDeferredValue(session);
  const { data, error, isPending } = session.data ? session : settled;

  return (
    <AuthSessionContext value={{ data, error, isPending }}>
      {children}
    </AuthSessionContext>
  );
}

/** Keeps isolated authoring previews signed out without a backend request. */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  if (env.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD === "true") {
    return (
      <AuthSessionContext value={previewSession}>{children}</AuthSessionContext>
    );
  }
  return <BetterAuthSessionProvider>{children}</BetterAuthSessionProvider>;
}

/** Selects one part of the shared session and rejects a missing app provider. */
export function useAuthSession<T>(selector: (session: AuthSession) => T) {
  const value = use(AuthSessionContext);
  if (!value) {
    throw new TypeError(
      "useAuthSession must be used within AuthSessionProvider"
    );
  }
  return selector(value);
}
