import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import { Sidebar } from "@repo/design-system/components/ui/sidebar-shell";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";
import { HeaderMenu } from "@/components/sidebar/header/brand";
import { SearchMenu } from "@/components/sidebar/search/trigger";
import { NavUser } from "@/components/sidebar/user/nav";

export function AppSidebar({
  navigation,
  ...props
}: ComponentProps<typeof Sidebar> & {
  navigation: ReactNode;
}) {
  return (
    <Sidebar className={cn("z-20", props.className)} side="left" {...props}>
      <SidebarHeader className="border-b">
        <HeaderMenu />
        <SearchMenu />
      </SidebarHeader>
      <SidebarContent>{navigation}</SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <NavUser />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
