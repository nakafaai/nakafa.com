import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import { Sidebar } from "@repo/design-system/components/ui/sidebar-shell";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";
import { HeaderMenu } from "@/components/sidebar/header-menu";
import { NavExplore } from "@/components/sidebar/nav-explore";
import { NavForYou } from "@/components/sidebar/nav-for-you";
import { NavUser } from "@/components/sidebar/nav-user";
import { SearchMenu } from "@/components/sidebar/search-menu";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar className={cn("z-20", props.className)} side="left" {...props}>
      <SidebarHeader className="border-b">
        <HeaderMenu />
        <SearchMenu />
      </SidebarHeader>
      <SidebarContent>
        <NavForYou />
        <NavExplore />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <NavUser />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
