"use client";

import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import { SidebarInset } from "@repo/design-system/components/ui/sidebar-shell";
import type { ReactNode } from "react";
import { DeferredAiSheet } from "@/components/ai/deferred-sheet";
import { DeferredSearchCommand } from "@/components/shared/deferred-search-command";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Header } from "@/components/sidebar/header";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";

/**
 * Renders the persistent app shell for the main student area.
 */
export function AppShell({
  articleNavigation,
  children,
  locked = false,
}: {
  articleNavigation: readonly ArticleNavigationItem[];
  children: ReactNode;
  locked?: boolean;
}) {
  return (
    <SidebarProvider locked={locked}>
      <SidebarInset>
        <Header />
        <DeferredSearchCommand articleNavigation={articleNavigation} />
        <DeferredAiSheet />
        <div className="relative">{children}</div>
      </SidebarInset>
      <AppSidebar
        articleNavigation={articleNavigation}
        containerClassName="order-first"
      />
    </SidebarProvider>
  );
}
