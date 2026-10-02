"use client";

import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import { SidebarInset } from "@repo/design-system/components/ui/sidebar-shell";
import {
  createContext,
  type ReactNode,
  use,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/** The visible pages that currently hold the shell locked. */
interface ShellLockState {
  /** Holds the lock until the returned release runs. */
  readonly lock: () => () => void;
  readonly locks: number;
}

const ShellLockContext = createContext<StoreApi<ShellLockState> | null>(null);

/** Creates the lock state owned by one shell instance. */
function createShellLockStore() {
  return createStore<ShellLockState>()((set) => ({
    locks: 0,
    lock: () => {
      set((state) => ({ locks: state.locks + 1 }));
      return () => set((state) => ({ locks: state.locks - 1 }));
    },
  }));
}

/**
 * Lays the app shell out around its page. While a page holds the lock, as a
 * running try-out attempt does, the shell hides its header, search, Nina, and
 * sidebar, and the page takes the whole screen. The shell itself stays
 * mounted, so locking and unlocking never replaces it.
 *
 * Two sources lock it. After hydration, the lock store does: the header
 * unmounts, the sidebar ignores its toggles, and `data-locked` hides the
 * sidebar. Before hydration only the server markup exists, so a locked page
 * renders a `data-shell-lock` marker that the same styles read, and the first
 * paint of a running attempt already shows the locked shell.
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
  const [store] = useState(createShellLockStore);
  const locked = useStore(store, (state) => state.locks > 0);

  return (
    <ShellLockContext value={store}>
      <SidebarProvider
        className="[--app-header-top:4rem] has-[[data-shell-lock]]:[--app-header-top:0px] data-locked:[--app-header-top:0px]"
        data-locked={locked ? "" : undefined}
        locked={locked}
      >
        <SidebarInset>
          {locked ? null : (
            <div className="contents group-has-[[data-shell-lock]]/sidebar-wrapper:hidden">
              {header}
            </div>
          )}
          {/* Pages lay out in normal flow. A flex column here would shrink every
              centered page column to its content. */}
          <div className="relative">{children}</div>
        </SidebarInset>
        {/* Hidden rather than collapsed, so locking and unlocking swap the
            sidebar at once instead of animating its width. */}
        <div className="contents group-has-[[data-shell-lock]]/sidebar-wrapper:hidden group-data-locked/sidebar-wrapper:hidden">
          {sidebar}
        </div>
      </SidebarProvider>
    </ShellLockContext>
  );
}

/** Selects from the lock state of the nearest shell. */
function useShellLock<Selected>(selector: (state: ShellLockState) => Selected) {
  const store = use(ShellLockContext);
  if (!store) {
    throw new Error("useShellLock must be used within a LockableShell");
  }

  return useStore(store, selector);
}

/** Whether React is hydrating never changes once it is known. */
function subscribeNever() {
  return () => undefined;
}

/**
 * Locks the shell while this element is mounted and visible. The lock applies
 * in a layout effect, so it lands before the browser paints the page that
 * rendered it, and it releases when that page unmounts or Next.js hides it on
 * navigation. Until then, the server markup carries the lock as a marker that
 * leaves the document once this page hydrates, so a page Next.js keeps hidden
 * never holds the shell.
 */
export function ShellLock() {
  const lock = useShellLock((state) => state.lock);
  const hydrating = useSyncExternalStore(
    subscribeNever,
    () => false,
    () => true
  );

  useLayoutEffect(() => lock(), [lock]);

  return hydrating ? <span data-shell-lock="" hidden /> : null;
}

/**
 * Keeps the shell as locked or unlocked as it was while the page that decides
 * the lock is still loading. Moving from a running attempt to a page that
 * resolves the attempt again then keeps the shell locked instead of briefly
 * showing the sidebar and header. The state is read when this page first
 * renders, while the previous page still holds its lock.
 */
export function ShellLockHold() {
  const locked = useShellLock((state) => state.locks > 0);
  const lock = useShellLock((state) => state.lock);
  const [held] = useState(locked);

  useLayoutEffect(() => (held ? lock() : undefined), [held, lock]);

  return null;
}
