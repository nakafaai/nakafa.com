import type { ReactNode } from "react";
import { SchoolSettingsHeader } from "@/components/tenant/settings/header";

/**
 * One School settings section that changes something: its one header, with the path to
 * the section and the section's own action at the end, then one card per change across
 * the page's full width, two side by side from the large width. Cards in one row take the
 * same height and end with their footers on one line; a card that would stand alone in its
 * row, or a body with one card, spans the row.
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
      <div className="wrap-anywhere grid w-full min-w-0 grid-cols-1 gap-6 p-6 lg:grid-cols-2 lg:[&>:last-child:nth-child(odd)]:col-span-2 [&_[data-slot=card-footer]]:mt-auto">
        {children}
      </div>
    </>
  );
}

/**
 * One School settings section that lists records: its one header, with the path to the
 * section, then what works on the list and the section's main action at the end, and
 * the list as the whole body, from edge to edge. A data table draws itself in it.
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
      <div className="flex w-full min-w-0 flex-1 flex-col">{children}</div>
    </>
  );
}
