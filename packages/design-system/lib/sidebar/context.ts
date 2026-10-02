"use client";

import { createContext, use } from "react";
import { createStore, useStore } from "zustand";

/** Responsive state and actions shared by composed sidebar components. */
export interface SidebarContextValue {
  isLocked: boolean;
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  setOpen: (open: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  state: "expanded" | "collapsed";
  toggleSidebar: () => void;
}

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
export const SidebarContext = createContext<
  | (Pick<
      SidebarContextValue,
      "isLocked" | "setOpen" | "setOpenMobile" | "toggleSidebar"
    > &
      Partial<Pick<SidebarContextValue, "open">>)
  | null
>(null);

/** Selects one part of the sidebar state and actions of the nearest SidebarProvider. */
export function useSidebar<T>(selector: (sidebar: SidebarContextValue) => T) {
  const store = use(SidebarStoreContext);
  const controls = use(SidebarContext);
  if (!(store && controls)) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  const isMobile = useStore(store, (sidebar) => sidebar.isMobile);
  const storedOpen = useStore(store, (sidebar) => sidebar.open);
  const storedOpenMobile = useStore(store, (sidebar) => sidebar.openMobile);
  const open = controls.open ?? storedOpen;

  return selector({
    isLocked: controls.isLocked,
    isMobile,
    open,
    openMobile: controls.isLocked ? false : storedOpenMobile,
    setOpen: controls.setOpen,
    setOpenMobile: controls.setOpenMobile,
    state: open ? "expanded" : "collapsed",
    toggleSidebar: controls.toggleSidebar,
  });
}
