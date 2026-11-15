import type { ReactNode } from "react";
import { PageStack } from "@/components/shared/page/body";
import { UserSettingsHeader } from "@/components/user/settings/header";

/**
 * One settings section that changes something: its header, then one card per
 * change in the settings column. A library, such as the connectors, draws its own
 * header with its search and fills the frame with its panes instead.
 */
export function UserSettingsPage({ children }: { children: ReactNode }) {
  return (
    <>
      <UserSettingsHeader />
      <PageStack>{children}</PageStack>
    </>
  );
}
