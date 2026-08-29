"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { useTranslations } from "next-intl";

/**
 * Reserves the footer footprint for the confirmed account mode while auth and
 * profile data settle, defaulting unresolved public sessions to the guest UI.
 */
export function NavUserSkeleton({ mode }: { mode: "account" | "guest" }) {
  const t = useTranslations("Auth");

  if (mode === "account") {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton aria-hidden disabled size="lg">
          <Skeleton className="aspect-square size-8 rounded-md" />
          <div className="grid min-w-0 flex-1 gap-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="ml-auto size-4 rounded-full" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

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
