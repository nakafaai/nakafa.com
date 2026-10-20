"use client";

import { type ReactNode, use, useState } from "react";
import { createStore, useStore } from "zustand";
import { AuthSessionContext } from "@/components/auth/context";
import { type AuthSession, previewAuthSession } from "@/lib/auth/session";

/**
 * Provides the signed-out session without a backend request: isolated authoring
 * previews, and public pages that a visitor without the signed-in hint reads.
 */
export function SignedOutSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [store] = useState(() => createStore(() => previewAuthSession));

  return <AuthSessionContext value={store}>{children}</AuthSessionContext>;
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
