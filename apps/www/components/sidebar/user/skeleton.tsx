"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { useTranslations } from "next-intl";

/**
 * Reserves the complete guest footer footprint while auth and profile data
 * settle so signed-out visitors do not see the navigation jump.
 */
export function NavUserSkeleton() {
  const t = useTranslations("Auth");

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton aria-hidden disabled>
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-4 w-28" />
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton aria-hidden disabled>
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-4 w-24" />
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton aria-hidden disabled>
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-4 w-20" />
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem
        aria-hidden
        className="-mx-2 my-1 border-sidebar-border border-t"
      />
      <SidebarMenuItem className="flex flex-col gap-3 px-2 py-1">
        <div aria-hidden className="grid gap-1">
          <div className="relative overflow-hidden font-medium text-sm">
            <span className="invisible">{t("login-cta-title")}</span>
            <Skeleton className="absolute inset-y-0 left-0 my-auto h-4 w-28" />
          </div>
          <div className="relative overflow-hidden text-sm leading-snug">
            <span className="invisible">{t("login-cta-description")}</span>
            <span className="absolute inset-0 grid content-start gap-1 py-0.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3.5 w-2/3" />
            </span>
          </div>
        </div>
        <Button aria-hidden className="w-full" disabled>
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-4 w-12" />
        </Button>
      </SidebarMenuItem>
    </>
  );
}
