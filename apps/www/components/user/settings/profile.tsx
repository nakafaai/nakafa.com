"use client";

import type { ReactNode } from "react";
import { UserSettingsDeleteAccount } from "@/components/user/settings/deletion";
import { UserSettingsName } from "@/components/user/settings/name";
import { UserSettingsRole } from "@/components/user/settings/role";
import { type CurrentUser, useViewer } from "@/lib/identity/client";

export function UserSettingsProfilePage({
  children,
  initialAccount,
}: {
  children: ReactNode;
  initialAccount: CurrentUser;
}) {
  const identity = useViewer((state) => state);
  const user = identity.isPending ? initialAccount : identity.account;

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
