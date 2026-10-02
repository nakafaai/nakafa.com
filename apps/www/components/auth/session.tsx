"use client";

import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import { env } from "@/env";
import { authClient } from "@/lib/auth/client";
import {
  type AuthSession,
  followAuthSession,
  previewAuthSession,
  readAuthSession,
} from "@/lib/auth/session";

const AuthSessionContext = createContext<StoreApi<AuthSession> | null>(null);

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
  const session = authClient.$store.atoms.session;
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

/** Keeps isolated authoring previews signed out without a backend request. */
function PreviewSessionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createStore(() => previewAuthSession));

  return <AuthSessionContext value={store}>{children}</AuthSessionContext>;
}

/** Provides the one live session for every app authentication reader. */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  if (env.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD === "true") {
    return <PreviewSessionProvider>{children}</PreviewSessionProvider>;
  }
  return <BetterAuthSessionProvider>{children}</BetterAuthSessionProvider>;
}

/** Returns the session store and rejects a missing app provider. */
export function useAuthSessionStore() {
  const store = use(AuthSessionContext);
  if (!store) {
    throw new TypeError(
      "useAuthSession must be used within AuthSessionProvider"
    );
  }
  return store;
}

/** Selects one part of the shared session. */
export function useAuthSession<T>(selector: (session: AuthSession) => T) {
  return useStore(useAuthSessionStore(), selector);
}
