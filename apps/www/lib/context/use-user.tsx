"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { type Preloaded, useConvexAuth, usePreloadedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { createContext, useContextSelector } from "use-context-selector";

export type CurrentUser = NonNullable<
  FunctionReturnType<typeof api.auth.queries.getCurrentUser>
>;

interface UserContextValue {
  isAuthenticated: boolean;
  isPending: boolean;
  user: CurrentUser | null;
}

const UserContext = createContext<UserContextValue | null>(null);
const missingUserContext = Symbol("UserContext");

/**
 * Provides the current Better Auth and app-user snapshot to client components.
 *
 * Client components stay presentational; only this boundary decides whether the
 * account arrives from the request credential or the live auth session.
 */
function UserValueProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: UserContextValue;
}) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * Resolves the current-user snapshot for a protected route that already read
 * its own request token.
 *
 * Seeding the request credential keeps the greeting and personalized defaults
 * in the first client paint, so hydration cannot introduce an empty identity
 * and shift the page.
 */
export function SeededUserProvider({
  children,
  currentUser,
}: {
  children: ReactNode;
  currentUser: Preloaded<typeof api.auth.queries.getCurrentUser>;
}) {
  const user = usePreloadedQuery(currentUser);

  return (
    <UserValueProvider
      value={{ isAuthenticated: true, isPending: false, user }}
    >
      {children}
    </UserValueProvider>
  );
}

/**
 * Resolves the current-user snapshot from the client Better Auth session.
 */
export function UserContextProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const shouldLoadUser = isAuthenticated && !isLoading;
  const userQuery = useQueryWithStatus(
    api.auth.queries.getCurrentUser,
    shouldLoadUser ? {} : "skip"
  );
  const user = userQuery.isSuccess ? userQuery.data : null;
  const isPending = isLoading || (shouldLoadUser && userQuery.isPending);

  return (
    <UserValueProvider value={{ isAuthenticated, isPending, user }}>
      {children}
    </UserValueProvider>
  );
}

/**
 * Read one derived slice of the current user context.
 */
export function useUser<T>(selector: (state: UserContextValue) => T) {
  const selected = useContextSelector(UserContext, (context) =>
    context ? selector(context) : missingUserContext
  );
  if (selected === missingUserContext) {
    throw new Error("useUser must be used within a UserContextProvider");
  }
  return selected;
}
