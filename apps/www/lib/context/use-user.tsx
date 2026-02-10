"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { AppUser } from "@repo/backend/convex/auth";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { createContext, useContextSelector } from "use-context-selector";

interface UserContextValue {
  user: AppUser | null;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user } = useQueryWithStatus(api.auth.getCurrentUser);

  return (
    <UserContext.Provider value={{ user: user || null }}>
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
