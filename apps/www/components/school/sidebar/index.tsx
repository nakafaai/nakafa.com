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
import { SchoolSidebarNavYours } from "@/components/school/sidebar/nav-yours";
import { SchoolSwitcher } from "@/components/school/sidebar/school-switcher";
import { LangMenu } from "@/components/sidebar/lang-menu";
import { ThemeMenu } from "@/components/sidebar/theme-menu";
import { getSchoolSwitcherPage } from "@/lib/school/server";

/** Render the School sidebar and preload the switcher shell page on the server. */
export async function SchoolSidebar({
  ...props
}: ComponentProps<typeof Sidebar>) {
  const initialSchoolPage = await getSchoolSwitcherPage();

  return (
    <Sidebar className={cn("z-20", props.className)} side="left" {...props}>
      <SidebarHeader className="border-b">
        <SchoolSwitcher initialSchoolPage={initialSchoolPage} />
      </SidebarHeader>
      <SidebarContent>
        <SchoolSidebarNavYours />
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
