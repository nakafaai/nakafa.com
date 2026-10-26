import type { ReactNode } from "react";
import { LayoutContent } from "@/components/shared/content/frame";
import { TablePageBody } from "@/components/shared/table/frame";
import { SchoolSettingsHeader } from "@/components/tenant/settings/header";

/**
 * One School settings section that changes something: its one header, with the path to
 * the section and the section's own action at the end, then one card per change in the
 * settings column.
 */
export function SettingsPage({
  actions,
  children,
}: {
  /** The section's own action, such as Add period, in the header. */
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

/**
 * One School settings section that lists records: its one header, with the path to the
 * section, then what works on the list and the section's main action at the end, and
 * the list as the whole body, in the one card of a table page (`TablePageBody`). A data
 * table, or the empty state in its place, draws itself in the card.
 */
export function SettingsTablePage({
  actions,
  children,
}: {
  /** The list's search and filter, then the section's main action, such as Invite. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <SchoolSettingsHeader>{actions}</SchoolSettingsHeader>
      <TablePageBody>{children}</TablePageBody>
    </>
  );
}
