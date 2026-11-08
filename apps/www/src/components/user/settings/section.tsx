import type { ReactNode } from "react";
import { LayoutContent } from "@/components/shared/content/frame";
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
      <LayoutContent className="flex flex-col gap-6 py-6">
        {children}
      </LayoutContent>
    </>
  );
}
