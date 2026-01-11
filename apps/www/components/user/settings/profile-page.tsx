"use client";

import { Authenticated } from "convex/react";
import { UserSettingsName } from "@/components/user/settings/name";
import { UserSettingsRole } from "@/components/user/settings/role";
import { useUser } from "@/lib/context/use-user";

export function UserSettingsProfilePage() {
  const user = useUser((state) => state.user);

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
