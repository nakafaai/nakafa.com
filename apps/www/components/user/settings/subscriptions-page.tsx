"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { UserSettingsSubscriptions } from "@/components/user/settings/subscriptions";

export function UserSettingsSubscriptionsPage() {
  const user = useQuery(api.auth.getCurrentUser);

  if (!user) {
    return null;
  }

  return <UserSettingsSubscriptions user={user} />;
}
