"use client";

import {
  SidebarInset,
  SidebarProvider,
} from "@repo/design-system/components/ui/sidebar";
import type { ReactNode } from "react";
import { AiSheet } from "@/components/ai/sheet";
import { Onboarding } from "@/components/shared/onboarding";
import { SearchCommand } from "@/components/shared/search-command";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Header } from "@/components/sidebar/header";
import { useTryoutSidebarLocked } from "@/components/tryout/hooks/use-sidebar-locked";

/**
 * Renders the persistent app shell for the main student area.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const isSidebarLocked = useTryoutSidebarLocked();

  return (
    <SidebarProvider locked={isSidebarLocked}>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <SearchCommand />
        <AiSheet />
        <div className="relative" data-pagefind-body>
          {children}
        </div>
        <Onboarding />
      </SidebarInset>
    </SidebarProvider>
  );
}
