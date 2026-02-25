import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
} from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";
import { AboutMenu } from "./about-menu";
import { CommunityButton } from "./community-button";
import { HeaderMenu } from "./header-menu";
import { LangMenu } from "./lang-menu";
import { NavArticles } from "./nav-articles";
import { NavExercises } from "./nav-exercises";
import { NavHoly } from "./nav-holy";
import { NavSubject } from "./nav-subject";
import { NavUser } from "./nav-user";
import { SearchMenu } from "./search-menu";
import { ThemeMenu } from "./theme-menu";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      className={cn("z-20", props.className)}
      side="left"
      variant="floating"
      {...props}
    >
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
