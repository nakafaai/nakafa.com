"use client";

import { useHotkeys } from "@mantine/hooks";
import { TooltipProvider } from "@repo/design-system/components/ui/tooltip";
import {
  createMaxWidthInclusiveMediaQuery,
  createMaxWidthMediaQuery,
  TAILWIND_BREAKPOINT_PIXELS,
} from "@repo/design-system/lib/breakpoints";
import { runSidebarStateProgram } from "@repo/design-system/lib/sidebar/boundary";
import {
  createSidebarStore,
  SidebarContext,
  SidebarStoreContext,
} from "@repo/design-system/lib/sidebar/context";
import {
  BrowserSidebarCookieWriterLive,
  persistSidebarState,
  SIDEBAR_COOKIE_NAME,
} from "@repo/design-system/lib/sidebar/persistence";
import { cn } from "cn";
import { Effect } from "effect";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

/** Default modifier-key shortcut used to toggle the sidebar. */
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

/** Desktop breakpoint that switches the sidebar from sheet to panel. */
const SIDEBAR_DESKTOP = TAILWIND_BREAKPOINT_PIXELS.lg;

/**
 * Provides responsive, persistent sidebar state for an app shell.
 *
 * When `locked` is true, the sidebar ignores toggle actions and keeps the
 * mobile sheet closed. The desktop panel keeps its state, so the shell that
 * hides it while locked shows it unchanged once the lock ends.
 *
 * The open state and the measured viewport live in a store created once per
 * provider. The context carries only the memoized actions, the lock, and the
 * controlled `open` prop, so toggling or resizing never changes a context
 * value: React client-renders streamed Suspense boundaries that are still
 * pending when an ancestor context changes, discarding the HTML the server
 * sent.
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
  const mobileMediaQuery =
    sidebarDesktop === undefined
      ? createMaxWidthMediaQuery(SIDEBAR_DESKTOP)
      : createMaxWidthInclusiveMediaQuery(sidebarDesktop);
  const [store] = useState(() => createSidebarStore(defaultOpen));
  const isLocked = locked;

  // The viewport is known only in the browser; the server renders the
  // desktop layout and the store follows the media query once mounted.
  useEffect(() => {
    const query = window.matchMedia(mobileMediaQuery);
    const follow = () => {
      store.setState({ isMobile: query.matches });
    };
    follow();
    query.addEventListener("change", follow);
    return () => {
      query.removeEventListener("change", follow);
    };
  }, [mobileMediaQuery, store]);

  const setOpen = useCallback(
    (value: boolean | ((previous: boolean) => boolean)) => {
      if (isLocked) {
        return;
      }

      const open = openProp ?? store.getState().open;
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        store.setState({ open: openState });
      }

      runSidebarStateProgram(
        persistSidebarState({
          cookieName: cookieName ?? SIDEBAR_COOKIE_NAME,
          open: openState,
        }).pipe(Effect.provide(BrowserSidebarCookieWriterLive))
      );
    },
    [cookieName, isLocked, openProp, setOpenProp, store]
  );
  const setOpenMobile = useCallback(
    (value: boolean | ((previous: boolean) => boolean)) => {
      const { openMobile } = store.getState();
      const nextOpen =
        typeof value === "function"
          ? value(isLocked ? false : openMobile)
          : value;
      store.setState({ openMobile: isLocked ? false : nextOpen });
    },
    [isLocked, store]
  );
  const toggleSidebar = useCallback(() => {
    if (isLocked) {
      return;
    }

    // Read the current viewport at the interaction boundary so a toggle
    // during the first frames routes to the right surface.
    if (window.matchMedia(mobileMediaQuery).matches) {
      setOpenMobile((previous) => !previous);
      return;
    }

    setOpen((previous) => !previous);
  }, [isLocked, mobileMediaQuery, setOpen, setOpenMobile]);

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

  const controls = useMemo(
    () => ({
      isLocked,
      setOpen,
      setOpenMobile,
      toggleSidebar,
      ...(openProp === undefined ? {} : { open: openProp }),
    }),
    [isLocked, openProp, setOpen, setOpenMobile, toggleSidebar]
  );

  return (
    <SidebarStoreContext value={store}>
      <SidebarContext value={controls}>
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
      </SidebarContext>
    </SidebarStoreContext>
  );
}
