"use client";

import { Authenticated } from "convex/react";
import { UserSettingsSubscriptions } from "@/components/user/settings/subscriptions";

export function UserSettingsSubscriptionsPage() {
  return (
    <Authenticated>
      <UserSettingsSubscriptions />
    </Authenticated>
  );
}
