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
import { ArrowUpRightIcon, PencilRulerIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { LangMenu } from "@/components/sidebar/lang-menu";
import { ThemeMenu } from "@/components/sidebar/theme-menu";

export function SchoolSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const t = useTranslations("Onboarding");

  return (
    <Sidebar
      className={cn("z-20", props.className)}
      side="left"
      variant="floating"
      {...props}
    >
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="group/main justify-between">
              <NavigationLink href="/" title="Start Learning">
                <div className="flex items-center gap-2">
                  <PencilRulerIcon className="size-4" />
                  {t("button")}
                </div>
                <div className="hidden items-center opacity-0 transition-opacity ease-out group-hover/main:opacity-100 lg:flex">
                  <ArrowUpRightIcon className="size-3.5 shrink-0" />
                </div>
              </NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent />
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <LangMenu />
          <ThemeMenu />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
