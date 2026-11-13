import { type ReactNode, useEffect, useState } from "react";
import { createStore } from "zustand";
import { AuthSessionContext } from "@/components/auth/context";
import {
  SignedOutSessionProvider,
  useSignedInHint,
} from "@/components/auth/session";
import { clientEnv } from "@/env.public";
import { followClientSession } from "@/lib/auth/client";
import { followAuthSession, previewAuthSession } from "@/lib/auth/session";
import { readConvexClient } from "@/lib/convex/client";

/**
 * Follows Convex Auth's session in a store created once per provider.
 *
 * The session resolves after hydration, and React client-renders a streamed
 * Suspense boundary that is still pending when an ancestor context changes,
 * discarding the HTML the server sent. The context therefore carries only the
 * store; readers subscribe with `useStore`, whose server snapshot is the
 * pending session the server rendered.
 * https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering
 */
function ClientSessionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() =>
    createStore(() => ({ ...previewAuthSession, isPending: true }))
  );

  useEffect(
    () =>
      followClientSession(
        readConvexClient(clientEnv.VITE_CONVEX_URL)
      ).subscribe((value) => {
        store.setState((previous) => followAuthSession(previous, value), true);
      }),
    [store]
  );
  useSignedInHint(store);

  return <AuthSessionContext value={store}>{children}</AuthSessionContext>;
}

/** Provides the one live session for every app authentication reader. */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  if (clientEnv.VITE_AKSARA_PREVIEW_CHILD === "true") {
    return <SignedOutSessionProvider>{children}</SignedOutSessionProvider>;
  }
  return <ClientSessionProvider>{children}</ClientSessionProvider>;
}
