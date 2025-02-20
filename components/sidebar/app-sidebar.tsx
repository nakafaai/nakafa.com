"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { ComponentProps } from "react";

import { Link } from "@/i18n/routing";
import nakafaLogo from "@/public/logo.svg";
import Image from "next/image";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              asChild
            >
              <Link href="/">
                <div className="relative flex aspect-square size-8 items-center justify-center rounded-lg border">
                  <Image
                    src={nakafaLogo}
                    alt="Nakafa Logo"
                    fill
                    className="rounded-lg object-contain"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Nakafa</span>
                  <span className="truncate text-xs">Gratis & Berkualitas</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent />
      <SidebarFooter />
      <SidebarRail />
    </Sidebar>
  );
}
