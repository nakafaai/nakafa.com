"use client";

import { createContext, use } from "react";

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

const missingSidebar = Symbol("missing-sidebar");

/** @internal Context consumed by SidebarProvider and sidebar controls. */
export const SidebarContext = createContext<
  SidebarContextValue | typeof missingSidebar
>(missingSidebar);

/** Selects one part of the sidebar state and actions of the nearest SidebarProvider. */
export function useSidebar<T>(selector: (sidebar: SidebarContextValue) => T) {
  const value = use(SidebarContext);
  if (value === missingSidebar) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return selector(value);
}
