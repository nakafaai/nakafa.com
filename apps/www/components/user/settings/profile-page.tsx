"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Authenticated, useQuery } from "convex/react";
import { UserSettingsName } from "@/components/user/settings/name";
import { UserSettingsRole } from "@/components/user/settings/role";

export function UserSettingsProfilePage() {
  const user = useQuery(api.auth.getCurrentUser);

  if (!user) {
    return null;
  }

  return (
    <Authenticated>
      <UserSettingsName user={user} />
      <UserSettingsRole user={user} />
    </Authenticated>
  );
}
