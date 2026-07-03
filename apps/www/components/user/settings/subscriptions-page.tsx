"use client";

import { UserSettingsSubscriptions } from "@/components/user/settings/subscriptions";
import { useUser } from "@/lib/context/use-user";

export function UserSettingsSubscriptionsPage() {
  const user = useUser((state) => state.user);

  if (!user) {
    return null;
  }

  return <UserSettingsSubscriptions />;
}
