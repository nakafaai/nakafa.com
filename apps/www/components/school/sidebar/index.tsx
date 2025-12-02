import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
} from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";
import { SchoolSidebarNavLearning } from "@/components/school/sidebar/nav-learning";
import { SchoolSidebarNavUser } from "@/components/school/sidebar/nav-user";
import { SchoolSwitcher } from "@/components/school/sidebar/school-switcher";
import { LangMenu } from "@/components/sidebar/lang-menu";
import { ThemeMenu } from "@/components/sidebar/theme-menu";

export function SchoolSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      className={cn("z-20", props.className)}
      side="left"
      variant="inset"
      {...props}
    >
      <SidebarHeader className="border-b">
        <SchoolSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SchoolSidebarNavLearning />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <LangMenu />
          <ThemeMenu />
          <SchoolSidebarNavUser />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
