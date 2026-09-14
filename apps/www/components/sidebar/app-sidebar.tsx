import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar-content";
import { SidebarMenu } from "@repo/design-system/components/ui/sidebar-menu";
import { Sidebar } from "@repo/design-system/components/ui/sidebar-shell";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { HeaderMenu } from "@/components/sidebar/header-menu";
import { SidebarNavigation } from "@/components/sidebar/navigation";
import { SearchMenu } from "@/components/sidebar/search-menu";
import { NavUser } from "@/components/sidebar/user/nav";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";

export function AppSidebar({
  articleNavigation,
  ...props
}: ComponentProps<typeof Sidebar> & {
  articleNavigation: readonly ArticleNavigationItem[];
}) {
  return (
    <Sidebar className={cn("z-20", props.className)} side="left" {...props}>
      <SidebarHeader className="border-b">
        <HeaderMenu />
        <SearchMenu />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavigation articleNavigation={articleNavigation} />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <NavUser />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
