import type { ReactNode } from "react";
import { LayoutContent } from "@/components/shared/content/frame";
import { SchoolSettingsHeader } from "@/components/tenant/settings/header";

/**
 * One School settings section: its one header, with the path to the section and the
 * section's own action at the end, then its body in the settings column. A section that
 * lists records puts the action that adds one in the header and the records in a data
 * table; a section that changes something holds one card per change.
 */
export function SettingsPage({
  actions,
  children,
}: {
  /** The section's own action, such as Invite, in the header. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <SchoolSettingsHeader>{actions}</SchoolSettingsHeader>
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
        {children}
      </LayoutContent>
    </>
  );
}
