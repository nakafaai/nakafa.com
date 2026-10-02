"use client";

import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import { SidebarInset } from "@repo/design-system/components/ui/sidebar-shell";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  use,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";

/** Changes the count of visible pages that hold the nearest shell locked. */
const ShellLocksContext = createContext<Dispatch<
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

  return (
    <ShellLocksContext value={setLocks}>
      <SidebarProvider
        className="[--app-header-top:4rem] has-[[data-shell-lock]]:[--app-header-top:0rem] data-locked:[--app-header-top:0rem]"
        data-locked={locked ? "" : undefined}
        locked={locked}
      >
        {/* Pages lay out in normal flow directly inside main: a flex column
            would shrink every centered page column to its content, and a
            wrapper of their own would move when a lock change drops the
            header. */}
        <SidebarInset className="block transition-[--app-sidebar-offset] duration-200 ease-out [--app-shell-inset:var(--app-sidebar-offset)] [--app-sidebar-offset:0rem] lg:pl-(--app-shell-inset) group-has-[[data-shell-lock]]/sidebar-wrapper:[--app-shell-inset:0rem] group-has-[[data-side=left][data-sidebar-state=expanded]]/sidebar-wrapper:[--app-sidebar-offset:--spacing(64)] group-data-locked/sidebar-wrapper:[--app-shell-inset:0rem]">
          {locked ? null : (
            <div className="contents group-has-[[data-shell-lock]]/sidebar-wrapper:hidden">
              {header}
            </div>
          )}
          {children}
        </SidebarInset>
        {/* Hidden rather than collapsed, so locking and unlocking swap the
            sidebar at once and the learner's open or closed choice returns
            unchanged when the lock ends. */}
        <div className="contents group-has-[[data-shell-lock]]/sidebar-wrapper:hidden group-data-locked/sidebar-wrapper:hidden">
          {sidebar}
        </div>
      </SidebarProvider>
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

/** Whether React is hydrating never changes once it is known. */
function subscribeNever() {
  return () => undefined;
}

/**
 * Locks the shell while this element is mounted and visible. The lock applies
 * in a layout effect, so it lands before the browser paints the page that
 * rendered it, and it releases when that page unmounts or Next.js hides it on
 * navigation.
 *
 * The server markup and the hydrating page carry the lock as a marker instead,
 * so a running attempt paints locked before any script runs. The marker exists
 * only until this page hydrates: Next.js keeps a page it navigates away from
 * in the document, hidden, and a marker there would still lock the shell.
 */
export function ShellLock() {
  const setLocks = useShellLocks();
  const hydrating = useSyncExternalStore(
    subscribeNever,
    () => false,
    () => true
  );

  useLayoutEffect(() => {
    setLocks((count) => count + 1);
    return () => setLocks((count) => count - 1);
  }, [setLocks]);

  return hydrating ? <span data-shell-lock="" hidden /> : null;
}
