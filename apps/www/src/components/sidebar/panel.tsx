import {
  SidebarContent,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar-content";
import { Sidebar } from "@repo/design-system/components/ui/sidebar-shell";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "use-intl";
import { HeaderMenu } from "@/components/sidebar/header/brand";
import { SearchMenu } from "@/components/sidebar/search/trigger";
import { SidebarToggle } from "@/components/sidebar/toggle";
import { NavUser } from "@/components/sidebar/user/nav";

export function AppSidebar({
  navigation,
  ...props
}: Omit<ComponentProps<typeof Sidebar>, "label"> & {
  navigation: ReactNode;
}) {
  const tCommon = useTranslations("Common");

  return (
    <Sidebar
      className={cn("z-20", props.className)}
      collapsible="icon"
      label={tCommon("sidebar")}
      side="left"
      {...props}
    >
      <SidebarHeader className="border-b">
        <HeaderMenu />
        <SearchMenu />
      </SidebarHeader>
      <SidebarContent>{navigation}</SidebarContent>
      <SidebarToggle />
      <NavUser />
    </Sidebar>
  );
}
