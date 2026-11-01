"use client";

import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import {
  SidebarContext,
  type SidebarControls,
  type SidebarStore,
  SidebarStoreContext,
} from "@repo/design-system/lib/sidebar/context";
import { cn } from "cn";
import { createContext, type ReactNode, use } from "react";

/** The store and actions of the sidebar a scope keeps, or none outside a scope. */
const ScopeContext = createContext<{
  controls: SidebarControls;
  store: SidebarStore;
} | null>(null);

/**
 * Keeps the nearest sidebar for the triggers below it, so a page that mounts a sidebar of
 * its own, such as an outline beside a lesson, still opens the app's navigation from its
 * header. Render it inside the app's `SidebarProvider`. The kept values change only when the
 * provider's own do.
 */
export function SidebarScope({ children }: { children: ReactNode }) {
  const controls = use(SidebarContext);
  const store = use(SidebarStoreContext);

  return (
    <ScopeContext value={controls && store ? { controls, store } : null}>
      {children}
    </ScopeContext>
  );
}

/**
 * The start of a page header: the trigger of the sidebar the nearest scope keeps, whatever
 * sidebar sits between them, drawn in outline as every control of the row is. It draws nothing
 * outside a scope or while the kept sidebar is locked, so a header shared with pages outside the app shell, or
 * with a locked attempt, stays as it is there.
 */
export function SidebarScopeStart({
  className,
  label,
}: {
  className?: string;
  /** The name of the sidebar toggle, in the reader's language. */
  label: string;
}) {
  const scope = use(ScopeContext);

  if (scope === null || scope.controls.isLocked) {
    return null;
  }

  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      <SidebarContext value={scope.controls}>
        <SidebarStoreContext value={scope.store}>
          <SidebarTrigger className="size-9" label={label} variant="outline" />
        </SidebarStoreContext>
      </SidebarContext>
    </div>
  );
}
