import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
} from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";
import { AboutMenu } from "@/components/sidebar/about-menu";
import { CommunityButton } from "@/components/sidebar/community-button";
import { HeaderMenu } from "@/components/sidebar/header-menu";
import { LangMenu } from "@/components/sidebar/lang-menu";
import { NavArticles } from "@/components/sidebar/nav-articles";
import { NavExercises } from "@/components/sidebar/nav-exercises";
import { NavHoly } from "@/components/sidebar/nav-holy";
import { NavSubject } from "@/components/sidebar/nav-subject";
import { NavUser } from "@/components/sidebar/nav-user";
import { SearchMenu } from "@/components/sidebar/search-menu";
import { ThemeMenu } from "@/components/sidebar/theme-menu";

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
          <LangMenu />
          <ThemeMenu />
          <CommunityButton />
          <AboutMenu />
          <NavUser />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
