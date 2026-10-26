"use client";

import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import { SidebarScope } from "@repo/design-system/components/ui/sidebar-scope";
import { SidebarInset } from "@repo/design-system/components/ui/sidebar-shell";
import { useHydrated } from "@tanstack/react-router";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  use,
  useLayoutEffect,
  useState,
} from "react";

/** Changes the count of visible pages that hold the nearest shell locked. */
const ShellLocksContext = createContext<Dispatch<
  SetStateAction<number>
> | null>(null);

/** Changes the count of visible page headers that title the nearest shell. */
const ShellTitlesContext = createContext<Dispatch<
  SetStateAction<number>
> | null>(null);

/**
 * Lays the app shell out around its page. While a page holds the lock, as a
 * running try-out attempt does, the shell hides its header, search, Nina, and
 * sidebar, and the page takes the whole screen. The shell itself stays
 * mounted, so locking and unlocking never replaces it.
 *
 * Locking never moves `<main>`. The desktop sidebar overlays the page edge
 * instead of sitting beside it, and `<main>` keeps the page clear of it with a
 * padding, so `<main>` starts at the same point locked or not and only the new
 * page inside it differs. The padding follows the sidebar's own slide when the
 * learner toggles it, while a lock change switches it at once.
 *
 * The lock count is this shell's own state rather than a store. Pages change
 * it from a layout effect, and React applies every update scheduled there
 * before the browser paints, also in the commit that mounts or reveals this
 * shell, where a store reader would still wait for its passive subscription
 * and paint one frame unlocked around a locked page. While the count is above
 * zero, the header unmounts, the sidebar ignores its toggles, and
 * `data-locked` hides the sidebar. Before hydration the server markup carries
 * the lock instead, as a `data-shell-lock` marker that the same styles read.
 */
export function LockableShell({
  children,
  header,
  sidebar,
}: {
  children: ReactNode;
  header: ReactNode;
  sidebar: ReactNode;
}) {
  const [locks, setLocks] = useState(0);
  const locked = locks > 0;
  const [titles, setTitles] = useState(0);

  return (
    <ShellLocksContext value={setLocks}>
      <ShellTitlesContext value={setTitles}>
        <SidebarProvider
          className="[--app-header-top:4rem] has-[[data-shell-lock]]:[--app-header-top:0rem] has-[[data-shell-title]]:[--app-header-top:0rem] data-locked:[--app-header-top:0rem] data-titled:[--app-header-top:0rem]"
          data-locked={locked ? "" : undefined}
          data-titled={titles > 0 ? "" : undefined}
          locked={locked}
        >
          {/* Hidden rather than collapsed, so locking and unlocking swap the
            sidebar at once and the learner's open or closed choice returns
            unchanged when the lock ends. It comes before the page in the
            document: main's padding reads the expanded sidebar through :has(),
            and a long page paints before the browser has parsed all of it, so
            a sidebar after the page would arrive late and move the page. */}
          <div className="contents group-has-[[data-shell-lock]]/sidebar-wrapper:hidden group-data-locked/sidebar-wrapper:hidden">
            {sidebar}
          </div>
          {/* Pages lay out in normal flow directly inside main: a flex column
            would shrink every centered page column to its content, and a
            wrapper of their own would move when a lock change drops the
            header. */}
          <SidebarInset className="block transition-[--app-sidebar-offset] duration-surface [--app-shell-inset:var(--app-sidebar-offset)] [--app-sidebar-offset:0rem] lg:pl-(--app-shell-inset) group-has-[[data-shell-lock]]/sidebar-wrapper:[--app-shell-inset:0rem] group-has-[[data-side=left][data-sidebar-state=expanded]]/sidebar-wrapper:[--app-sidebar-offset:--spacing(64)] group-data-locked/sidebar-wrapper:[--app-shell-inset:0rem]">
            <SidebarScope>
              {locked ? null : (
                <div className="contents group-has-[[data-shell-lock]]/sidebar-wrapper:hidden">
                  {header}
                </div>
              )}
              {children}
            </SidebarScope>
          </SidebarInset>
        </SidebarProvider>
      </ShellTitlesContext>
    </ShellLocksContext>
  );
}

/** Reads the lock count setter of the nearest shell. */
function useShellLocks() {
  const setLocks = use(ShellLocksContext);
  if (!setLocks) {
    throw new Error("useShellLocks must be used within a LockableShell");
  }

  return setLocks;
}

/**
 * Locks the shell while this element is mounted. The lock applies in a layout
 * effect, so it lands before the browser paints the page that rendered it, and
 * it releases when that page unmounts on navigation.
 *
 * The server markup and the hydrating page carry the lock as a marker instead,
 * so a running attempt paints locked before any script runs. The marker is
 * rendered only until the page hydrates, so the lock it carries is the one
 * the layout effect holds from then on.
 */
export function ShellLock() {
  const setLocks = useShellLocks();
  const hydrated = useHydrated();

  useLayoutEffect(() => {
    setLocks((count) => count + 1);
    return () => setLocks((count) => count - 1);
  }, [setLocks]);

  return hydrated ? null : <span data-shell-lock="" hidden />;
}

/**
 * Titles the shell while this element is mounted: a page that draws its own
 * header row takes the place of the shell's bar on a phone. The title applies in a
 * layout effect, so it lands before the browser paints the page, and it goes when
 * the page unmounts. The server markup and the hydrating page carry the title as a
 * marker instead, so the page paints titled before any script runs. Outside a shell
 * it does nothing.
 */
export function ShellTitle() {
  const setTitles = use(ShellTitlesContext);
  const hydrated = useHydrated();

  useLayoutEffect(() => {
    if (setTitles === null) {
      return;
    }
    setTitles((count) => count + 1);
    return () => setTitles((count) => count - 1);
  }, [setTitles]);

  return hydrated ? null : <span data-shell-title="" hidden />;
}
