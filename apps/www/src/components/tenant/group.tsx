import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import type { ReactNode } from "react";

/**
 * One group of the school sidebar, whose items are its children. The first group, the school's
 * main pages, needs no label; every other group is labelled with words alone. A group whose items
 * are the school's own data, such as its classes, marks each item with its animal.
 */
export function TenantSidebarGroup({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <SidebarGroup>
      {label === undefined ? null : (
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
