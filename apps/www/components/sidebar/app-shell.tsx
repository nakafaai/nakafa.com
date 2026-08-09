"use client";

import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import { SidebarInset } from "@repo/design-system/components/ui/sidebar-shell";
import type { ReactNode } from "react";
import { DeferredAiSheet } from "@/components/ai/deferred-sheet";
import { DeferredSearchCommand } from "@/components/shared/deferred-search-command";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Header } from "@/components/sidebar/header";

/**
 * Renders the persistent app shell for the main student area.
 */
export function AppShell({
  children,
  locked = false,
}: {
  children: ReactNode;
  locked?: boolean;
}) {
  return (
    <SidebarProvider locked={locked}>
      <SidebarInset>
        <Header />
        <DeferredSearchCommand />
        <DeferredAiSheet />
        <div className="relative">{children}</div>
      </SidebarInset>
      <AppSidebar containerClassName="order-first" />
    </SidebarProvider>
  );
}
