import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { FinanceSidebarChatList } from "@/components/finance/sidebar/chat-list";
import { LangMenu } from "@/components/sidebar/lang-menu";
import { ThemeMenu } from "@/components/sidebar/theme-menu";

export function FinanceSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const t = useTranslations("Ai");

  return (
    <Sidebar className={cn("z-20", props.className)} side="left" {...props}>
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              asChild
              className="w-full border border-sidebar-border shadow-none"
              size="sm"
              variant="secondary"
            >
              <NavigationLink href="/finance" title={t("new-chat")}>
                {t("new-chat")}
              </NavigationLink>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <FinanceSidebarChatList />
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <LangMenu />
          <ThemeMenu />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
