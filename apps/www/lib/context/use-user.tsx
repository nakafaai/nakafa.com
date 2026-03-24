"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContextSelector } from "use-context-selector";

export type CurrentUser = NonNullable<
  FunctionReturnType<typeof api.auth.getCurrentUser>
>;

interface UserContextValue {
  isPending: boolean;
  user: CurrentUser | null;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user, isPending } = useQueryWithStatus(api.auth.getCurrentUser);

  return (
    <UserContext.Provider value={{ user: user || null, isPending }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser<T>(selector: (state: UserContextValue) => T) {
  const context = useContextSelector(UserContext, (value) => value);
  if (!context) {
    throw new Error("useUser must be used within a UserContextProvider");
  }
  return selector(context);
}
