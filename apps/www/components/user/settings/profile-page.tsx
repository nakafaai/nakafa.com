"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { UserSettingsName } from "@/components/user/settings/name";

export function UserSettingsProfilePage() {
  const user = useQuery(api.auth.getCurrentUser);

  if (!user) {
    return null;
  }

  return <UserSettingsName user={user} />;
}
