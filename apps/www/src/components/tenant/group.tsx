import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import type { ReactNode } from "react";

/**
 * One labelled group of the school sidebar, whose items are its children. A group whose items are
 * the school's own data, such as its classes, marks each item with its animal and carries the one
 * icon of the group on its label instead.
 */
export function TenantSidebarGroup({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon?: IconSvgElement;
  label: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="gap-2">
        {icon === undefined ? null : <HugeIcons icon={icon} />}
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
