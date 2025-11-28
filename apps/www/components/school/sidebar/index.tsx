import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { SchoolSidebarNavMain } from "@/components/school/sidebar/nav-main";
import { SchoolSidebarNavUser } from "@/components/school/sidebar/nav-user";
import { LangMenu } from "@/components/sidebar/lang-menu";
import { ThemeMenu } from "@/components/sidebar/theme-menu";

export function SchoolSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const t = useTranslations("Onboarding");

  return (
    <Sidebar
      className={cn("z-20", props.className)}
      side="left"
      variant="inset"
      {...props}
    >
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavigationLink href="/" title="Start Learning">
                <ArrowLeftIcon />
                {t("button")}
              </NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SchoolSidebarNavMain />
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
