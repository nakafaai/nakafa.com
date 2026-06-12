import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
} from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";
import { HeaderMenu } from "@/components/sidebar/header-menu";
import { NavArticles } from "@/components/sidebar/nav-articles";
import { NavExercises } from "@/components/sidebar/nav-exercises";
import { NavHoly } from "@/components/sidebar/nav-holy";
import { NavSubject } from "@/components/sidebar/nav-subject";
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
        <NavSubject />
        <NavExercises />
        <NavHoly />
        <NavArticles />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <NavUser />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
