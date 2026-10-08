"use client";

import { createContext, use } from "react";
import { createStore, useStore } from "zustand";

/**
 * Merges one store snapshot with the provider's actions and lock into the
 * value every `useSidebar` selector reads.
 */
function buildSidebarValue(
  sidebar: ReturnType<ReturnType<typeof createSidebarStore>["getState"]>,
  controls: {
    readonly isLocked: boolean;
    readonly open?: boolean;
    readonly setOpen: (open: boolean) => void;
    readonly setOpenMobile: (open: boolean) => void;
    readonly toggleSidebar: () => void;
  }
) {
  const open = controls.open ?? sidebar.open;
  const state: "expanded" | "collapsed" = open ? "expanded" : "collapsed";

  return {
    isLocked: controls.isLocked,
    isMobile: sidebar.isMobile,
    open,
    openMobile: controls.isLocked ? false : sidebar.openMobile,
    setOpen: controls.setOpen,
    setOpenMobile: controls.setOpenMobile,
    state,
    toggleSidebar: controls.toggleSidebar,
  };
}

/** Responsive state and actions shared by composed sidebar components. */
export type SidebarContextValue = ReturnType<typeof buildSidebarValue>;

type SidebarControls = Parameters<typeof buildSidebarValue>[1];

/**
 * Creates one SidebarProvider's store with the state the server renders: the
 * panel open as configured, the mobile sheet closed, and the desktop layout
 * until the browser reports the viewport.
 */
export function createSidebarStore(defaultOpen: boolean) {
  return createStore(() => ({
    isMobile: false,
    open: defaultOpen,
    openMobile: false,
  }));
}

/**
 * @internal One SidebarProvider's store. The value never changes after
 * mount, because React discards streamed Suspense boundaries that are still
 * pending when an ancestor context changes; opening, closing, and measuring
 * the viewport only update the store.
 */
export const SidebarStoreContext = createContext<ReturnType<
  typeof createSidebarStore
> | null>(null);

/**
 * @internal One SidebarProvider's actions, lock, and controlled `open` prop.
 * The actions read the store when they run, so this value changes only when
 * the provider's props do.
 */
export const SidebarContext = createContext<SidebarControls | null>(null);

/**
 * Selects one part of the sidebar state and actions of the nearest
 * SidebarProvider.
 *
 * The selector runs inside the store subscription, so a reader runs only when
 * its selection changes: one that selects an action never rerenders when the
 * sidebar opens, closes, or measures the viewport.
 */
export function useSidebar<T>(selector: (sidebar: SidebarContextValue) => T) {
  const store = use(SidebarStoreContext);
  const controls = use(SidebarContext);
  if (!(store && controls)) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return useStore(store, (sidebar) =>
    selector(buildSidebarValue(sidebar, controls))
  );
}
