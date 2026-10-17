"use client";

import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import {
  Sidebar,
  SidebarInset,
  SidebarTrigger,
} from "@repo/design-system/components/ui/sidebar-shell";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TenantAccountMenu } from "@/components/tenant/account";
import { TenantContext, type TenantValue } from "@/components/tenant/context";

/**
 * The shell of a school: the school's name at the top of the sidebar, and the
 * sidebar groups of the signed-in viewer. The school layout admits only
 * members, so every item here is open to any member of the school.
 */
export function TenantShell({
  children,
  name,
  role,
}: TenantValue & { children: ReactNode }) {
  const t = useTranslations("School");

  return (
    <TenantContext value={{ name, role }}>
      <SidebarProvider>
        <Sidebar side="left">
          <SidebarHeader className="border-b">
            <p className="truncate px-2 font-medium text-sm">{name}</p>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>{t("for-you")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive render={<Link href="/" />}>
                      {t("home")}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <TenantAccountMenu />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 px-4">
            <SidebarTrigger />
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TenantContext>
  );
}
