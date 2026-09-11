"use client";

import { createContext, type ReactNode, use } from "react";
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

/** Reads the live session once for all app authentication consumers. */
function BetterAuthSessionProvider({ children }: { children: ReactNode }) {
  const { data, error, isPending } = authClient.useSession();

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

/** Reads the shared session and rejects a missing app provider. */
export function useAuthSession() {
  const session = use(AuthSessionContext);
  if (session === null) {
    throw new TypeError(
      "useAuthSession must be used within AuthSessionProvider"
    );
  }
  return session;
}
