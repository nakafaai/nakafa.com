import type { ReactNode } from "react";
import { UserSettingsRole } from "@/components/user/settings/role";
import { type CurrentUser, useViewer } from "@/lib/identity/client";

/**
 * Renders the learning section: the role card, then the curriculum card that
 * the route passes in as children.
 */
export function UserSettingsLearningPage({
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
      <UserSettingsRole user={user} />
      {children}
    </>
  );
}
