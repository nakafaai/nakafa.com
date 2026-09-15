"use client";

import type { ReactNode } from "react";
import { UserSettingsDeleteAccount } from "@/components/user/settings/delete-account";
import { UserSettingsName } from "@/components/user/settings/name";
import { UserSettingsRole } from "@/components/user/settings/role";
import { useViewer } from "@/lib/identity/client";

export function UserSettingsProfilePage({ children }: { children: ReactNode }) {
  const user = useViewer((state) => state.account);

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
