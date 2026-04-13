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
  const appUser = currentUser?.appUser ?? null;
  const authUser = currentUser?.authUser ?? null;

  useEffect(() => {
    if (isPending) {
      return;
    }

    const trackedUserId = analytics.get_property("$user_id");

    if (!appUser) {
      if (trackedUserId) {
        analytics.reset();
      }

      return;
    }

    if (!authUser) {
      return;
    }

    const personProperties = {
      email: authUser.email,
      name: authUser.name,
    };

    if (trackedUserId !== appUser._id) {
      analytics.identify(appUser._id, personProperties);
      return;
    }

    analytics.setPersonProperties(personProperties);
  }, [appUser, authUser, isPending]);

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
