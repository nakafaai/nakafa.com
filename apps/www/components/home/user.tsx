"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import type { ReactNode } from "react";
import {
  SeededUserProvider,
  UserContextProvider,
} from "@/lib/context/use-user";

/**
 * Seeds the home subtree with the account the route already resolved.
 *
 * The home route reads its own request token, so the greeting and personalized
 * defaults render with the real identity on the first client paint instead of
 * resolving after hydration and shifting the page. Without a resolved account
 * the subtree falls back to the live session so the page still renders.
 */
export function HomeUserProvider({
  children,
  currentUser,
}: {
  children: ReactNode;
  currentUser: Preloaded<typeof api.auth.queries.getCurrentUser> | undefined;
}) {
  if (!currentUser) {
    return <UserContextProvider>{children}</UserContextProvider>;
  }

  return (
    <SeededUserProvider currentUser={currentUser}>
      {children}
    </SeededUserProvider>
  );
}
