"use client";

import { useHotkeys, useMediaQuery } from "@mantine/hooks";
import { TooltipProvider } from "@repo/design-system/components/ui/tooltip";
import {
  createMaxWidthInclusiveMediaQuery,
  createMaxWidthMediaQuery,
  TAILWIND_BREAKPOINT_PIXELS,
} from "@repo/design-system/lib/breakpoints";
import {
  BrowserSidebarCookieWriterLive,
  persistSidebarState,
  SIDEBAR_COOKIE_NAME,
} from "@repo/design-system/lib/sidebar-state";
import { cn } from "@repo/design-system/lib/utils";
import { Effect } from "effect";
import {
  type ComponentProps,
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";

/** Default modifier-key shortcut used to toggle the sidebar. */
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";

/** Desktop breakpoint that switches the sidebar from sheet to panel. */
export const SIDEBAR_DESKTOP = TAILWIND_BREAKPOINT_PIXELS.lg;

interface SidebarContextProps {
  isLocked: boolean;
  isMobile: boolean;
  open: boolean;
  openMobile: boolean;
  setOpen: (open: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  state: "expanded" | "collapsed";
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextProps | null>(null);

/** Reads sidebar state and actions from the nearest SidebarProvider. */
export function useSidebar() {
  const context = use(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

/**
 * Provides responsive, persistent sidebar state for an app shell.
 *
 * When `locked` is true, the sidebar stays hidden and ignores toggle actions.
 */
export function SidebarProvider({
  defaultOpen = true,
  locked = false,
  sidebarDesktop,
  keyboardShortcut,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  cookieName,
  ...props
}: ComponentProps<"div"> & {
  defaultOpen?: boolean;
  locked?: boolean;
  open?: boolean;
  sidebarDesktop?: number;
  keyboardShortcut?: string;
  cookieName?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const isMobile = useMediaQuery(
    sidebarDesktop === undefined
      ? createMaxWidthMediaQuery(SIDEBAR_DESKTOP)
      : createMaxWidthInclusiveMediaQuery(sidebarDesktop)
  );
  const [mobileOpen, setMobileOpenState] = useState(false);
  const isLocked = locked;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = isLocked ? false : (openProp ?? uncontrolledOpen);
  const openMobile = isLocked ? false : mobileOpen;
  const setOpen = useCallback(
    (value: boolean | ((previous: boolean) => boolean)) => {
      const nextOpen = typeof value === "function" ? value(open) : value;
      const openState = isLocked ? false : nextOpen;

      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        setUncontrolledOpen(openState);
      }

      Effect.runSync(
        persistSidebarState({
          cookieName: cookieName ?? SIDEBAR_COOKIE_NAME,
          open: openState,
        }).pipe(Effect.provide(BrowserSidebarCookieWriterLive))
      );
    },
    [setOpenProp, open, cookieName, isLocked]
  );
  const setOpenMobile = useCallback(
    (value: boolean | ((previous: boolean) => boolean)) => {
      const nextOpen = typeof value === "function" ? value(mobileOpen) : value;
      setMobileOpenState(isLocked ? false : nextOpen);
    },
    [isLocked, mobileOpen]
  );

  const toggleSidebar = useCallback(() => {
    if (isLocked) {
      return;
    }

    if (isMobile) {
      setOpenMobile((previous) => !previous);
      return;
    }

    setOpen((previous) => !previous);
  }, [isLocked, isMobile, setOpen, setOpenMobile]);

  useHotkeys(
    isLocked
      ? []
      : [
          [
            `mod+${keyboardShortcut ?? SIDEBAR_KEYBOARD_SHORTCUT}`,
            () => toggleSidebar(),
          ],
        ]
  );

  const state = open ? "expanded" : "collapsed";
  const contextValue = useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      isLocked,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [
      state,
      open,
      setOpen,
      isMobile,
      isLocked,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    ]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider>
        <div
          className={cn(
            "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar",
            className
          )}
          data-slot="sidebar-wrapper"
          style={style}
          tabIndex={-1}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}
