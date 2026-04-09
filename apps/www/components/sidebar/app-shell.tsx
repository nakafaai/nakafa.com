"use client";

import {
  SidebarInset,
  SidebarProvider,
} from "@repo/design-system/components/ui/sidebar";
import type { ReactNode } from "react";
import { AiSheet } from "@/components/ai/sheet";
import { AppProviders } from "@/components/providers";
import { Onboarding } from "@/components/shared/onboarding";
import { SearchCommand } from "@/components/shared/search-command";
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
    <AppProviders>
      <SidebarProvider locked={locked}>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <SearchCommand />
          <AiSheet />
          <div className="relative">{children}</div>
          <Onboarding />
        </SidebarInset>
      </SidebarProvider>
    </AppProviders>
  );
}
