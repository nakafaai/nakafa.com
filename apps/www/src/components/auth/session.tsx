import { type ReactNode, use, useLayoutEffect, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import { AuthSessionContext } from "@/components/auth/context";
import { followSignedInHint } from "@/lib/auth/hint";
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

/**
 * Keeps the root's account slots on the hint cookie while a session store lives.
 * The inline script reads the hint once, but a page can outlive it: every answer
 * about the session corrects the cookie, so the root follows it again after each
 * change, and a page that took over from another route group starts from the
 * cookie as it is now, before its first frame. A page that signs its account out
 * holds its session (`holdSession`), so its slots stay until it leaves.
 */
export function useSignedInHint(session: StoreApi<AuthSession>) {
  useLayoutEffect(() => {
    const follow = () =>
      followSignedInHint(document.documentElement, document.cookie);
    follow();
    return session.subscribe(follow);
  }, [session]);
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
