"use client";

import { analytics } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect } from "react";
import { createContext, useContextSelector } from "use-context-selector";

export type CurrentUser = NonNullable<
  FunctionReturnType<typeof api.auth.getCurrentUser>
>;

interface UserContextValue {
  isPending: boolean;
  user: CurrentUser | null;
}

const UserContext = createContext<UserContextValue | null>(null);

/**
 * Provide the current Better Auth and app-user snapshot to client components and
 * keep PostHog identity aligned with that snapshot.
 *
 * References:
 * https://posthog.com/docs/product-analytics/identify
 * https://posthog.com/docs/libraries/js/features
 */
export function UserContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user, isPending } = useQueryWithStatus(api.auth.getCurrentUser);
  const currentUser = user ?? null;
  const userId = currentUser?.appUser._id ?? null;
  const userEmail = currentUser?.authUser.email ?? null;
  const userName = currentUser?.authUser.name ?? null;

  useEffect(() => {
    if (isPending) {
      return;
    }

    const trackedUserId = analytics.get_property("$user_id");

    if (!userId) {
      if (trackedUserId) {
        analytics.reset();
      }

      return;
    }

    if (userEmail === null || userName === null) {
      return;
    }

    const personProperties = {
      email: userEmail,
      name: userName,
    };

    if (trackedUserId !== userId) {
      analytics.identify(userId, personProperties);
      return;
    }

    analytics.setPersonProperties(personProperties);
  }, [isPending, userEmail, userId, userName]);

  return (
    <UserContext.Provider value={{ user: currentUser, isPending }}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * Read one derived slice of the current user context.
 */
export function useUser<T>(selector: (state: UserContextValue) => T) {
  const context = useContextSelector(UserContext, (value) => value);
  if (!context) {
    throw new Error("useUser must be used within a UserContextProvider");
  }
  return selector(context);
}
