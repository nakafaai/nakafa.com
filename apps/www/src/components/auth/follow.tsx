import { type ReactNode, useEffect, useState } from "react";
import { createStore } from "zustand";
import { AuthSessionContext } from "@/components/auth/context";
import { SignedOutSessionProvider } from "@/components/auth/session";
import { clientEnv } from "@/env.public";
import { readAuthClient } from "@/lib/auth/client";
import { followAuthSession, readAuthSession } from "@/lib/auth/session";

/**
 * Follows Better Auth's session atom in a store created once per provider.
 *
 * The session resolves after hydration, and React client-renders a streamed
 * Suspense boundary that is still pending when an ancestor context changes,
 * discarding the HTML the server sent. The context therefore carries only the
 * store; readers subscribe with `useStore`, whose server snapshot is the
 * pending session the server rendered. A settled session stays settled while
 * Better Auth refetches it.
 * https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering
 */
function BetterAuthSessionProvider({ children }: { children: ReactNode }) {
  const session = readAuthClient().$store.atoms.session;
  const [store] = useState(() =>
    createStore(() => readAuthSession(session.value))
  );

  useEffect(
    () =>
      session.subscribe((value) => {
        store.setState((previous) => followAuthSession(previous, value), true);
      }),
    [session, store]
  );

  return <AuthSessionContext value={store}>{children}</AuthSessionContext>;
}

/** Provides the one live session for every app authentication reader. */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  if (clientEnv.VITE_AKSARA_PREVIEW_CHILD === "true") {
    return <SignedOutSessionProvider>{children}</SignedOutSessionProvider>;
  }
  return <BetterAuthSessionProvider>{children}</BetterAuthSessionProvider>;
}
