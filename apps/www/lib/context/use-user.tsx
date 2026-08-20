"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useConvexAuth } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContextSelector } from "use-context-selector";

export type CurrentUser = NonNullable<
  FunctionReturnType<typeof api.auth.queries.getCurrentUser>
>;

interface UserContextValue {
  isPending: boolean;
  user: CurrentUser | null;
}

const UserContext = createContext<UserContextValue | null>(null);
const missingUserContext = Symbol("UserContext");

/**
 * Provides the current Better Auth and app-user snapshot to client components.
 */
export function UserContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const shouldLoadUser = isAuthenticated && !isLoading;
  const userQuery = useQueryWithStatus(
    api.auth.queries.getCurrentUser,
    shouldLoadUser ? {} : "skip"
  );
  const currentUser = userQuery.isSuccess ? userQuery.data : null;
  const isPending = isLoading || (shouldLoadUser && userQuery.isPending);

  const contextValue = {
    user: currentUser,
    isPending,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
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
