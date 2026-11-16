import { MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { SidebarMenuDescription } from "@repo/design-system/components/ui/sidebar-menu";
import type { ReactNode } from "react";

/**
 * The face of the account button: the picture, the name over the second line,
 * and the mark of its menu. The live button and the row the browser kept
 * (`sidebar/user/kept.tsx`) draw this one face, so they stand at one size and
 * the kept row gives way to the live one without moving the footer.
 */
export function AccountButtonFace({
  avatar,
  description,
  name,
}: {
  /** The account's picture. */
  avatar: ReactNode;
  /** The second line, such as a plan or a role. Left out, the button has one line. */
  description?: ReactNode;
  /** The account's name. */
  name: ReactNode;
}) {
  return (
    <>
      {avatar}
      {/* The menu's mark stands on the name's line, never between the name and the role. */}
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 text-left text-sm leading-tight">
        <span className="truncate">{name}</span>
        <HugeIcons icon={MoreVerticalIcon} />
        {description === undefined ? null : (
          <SidebarMenuDescription>{description}</SidebarMenuDescription>
        )}
      </div>
    </>
  );
}
