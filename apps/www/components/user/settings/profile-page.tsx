"use client";

import type { ReactNode } from "react";
import { UserSettingsDeleteAccount } from "@/components/user/settings/delete-account";
import { UserSettingsName } from "@/components/user/settings/name";
import { UserSettingsRole } from "@/components/user/settings/role";
import { useUser } from "@/lib/context/use-user";

export function UserSettingsProfilePage({ children }: { children: ReactNode }) {
  const user = useUser((state) => state.user);

  if (!user) {
    return null;
  }

  return (
    <>
      <UserSettingsName user={user} />
      <UserSettingsRole user={user} />
      {children}
      <UserSettingsDeleteAccount userId={user.appUser._id} />
    </>
  );
}
