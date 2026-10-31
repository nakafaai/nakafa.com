"use client";

import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import { SidebarScope } from "@repo/design-system/components/ui/sidebar-scope";
import { SidebarInset } from "@repo/design-system/components/ui/sidebar-shell";
import { useHydrated } from "@tanstack/react-router";
import { Effect } from "effect";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  use,
  useLayoutEffect,
  useState,
} from "react";
import { keptStorage } from "@/components/player/storage";
import {
  forgetPrepaintLock,
  PREPAINT_LOCK_ATTRIBUTE,
  PREPAINT_LOCK_SCRIPT,
  type PrepaintLock,
  releasePrepaintLock,
  rememberPrepaintLock,
} from "@/components/sidebar/prepaint";
import { reportClientException } from "@/lib/analytics/client";

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
 * A prerendered page cannot carry it, so the shell's first child is a script that
 * marks itself the same way before the first paint when the address names a lock
 * the browser remembers (`PREPAINT_LOCK_SCRIPT`); the mark goes once the shell's
 * own lock holds, or once the page decides it holds none (`usePrepaintRelease`).
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

  useLayoutEffect(() => {
    if (locked) {
      releasePrepaintLock(document);
    }
  }, [locked]);

  return (
    <ShellLocksContext value={setLocks}>
      <ShellTitlesContext value={setTitles}>
        <SidebarProvider
          className="[--app-header-top:4rem] has-[[data-shell-lock]]:[--app-header-top:0rem] has-[[data-shell-title]]:[--app-header-top:0rem] data-locked:[--app-header-top:0rem] data-titled:[--app-header-top:0rem]"
          data-locked={locked ? "" : undefined}
          data-titled={titles > 0 ? "" : undefined}
          locked={locked}
        >
          {/* The browser runs this script while it reads the server's markup, and React keeps the
            element without running it, so only a page load can mark it. */}
          <script
            {...{ [PREPAINT_LOCK_ATTRIBUTE]: "" }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: the script text is built from constants only.
            dangerouslySetInnerHTML={{ __html: PREPAINT_LOCK_SCRIPT }}
            suppressHydrationWarning
          />
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
          <SidebarInset className="duration-surface block transition-[--app-sidebar-offset] [--app-shell-inset:var(--app-sidebar-offset)] [--app-sidebar-offset:0rem] group-has-[[data-shell-lock]]/sidebar-wrapper:[--app-shell-inset:0rem] group-has-[[data-side=left][data-collapsible=icon]]/sidebar-wrapper:[--app-sidebar-offset:--spacing(12)] group-has-[[data-side=left][data-sidebar-state=expanded]]/sidebar-wrapper:[--app-sidebar-offset:--spacing(64)] group-data-locked/sidebar-wrapper:[--app-shell-inset:0rem] lg:pl-(--app-shell-inset)">
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
 * the layout effect holds from then on. A page given `remember` also has the
 * browser remember it until the lock ends, so a reload of a prerendered page
 * paints locked too (`PREPAINT_LOCK_SCRIPT`); the browser forgets it when the
 * page lets the shell go.
 */
export function ShellLock({
  remember,
}: {
  readonly remember?: typeof PrepaintLock.Type | undefined;
}) {
  const setLocks = useShellLocks();
  const hydrated = useHydrated();
  const name = remember?.name;
  const until = remember?.until;
  const value = remember?.value;

  useLayoutEffect(() => {
    setLocks((count) => count + 1);
    return () => setLocks((count) => count - 1);
  }, [setLocks]);

  useLayoutEffect(() => {
    if (name === undefined || until === undefined || value === undefined) {
      return;
    }
    Effect.runFork(
      rememberPrepaintLock({ name, until, value }).pipe(
        Effect.provide(keptStorage),
        Effect.catch((error) =>
          reportClientException(error, { source: "shell-prepaint-lock" })
        )
      )
    );
    return () => {
      Effect.runFork(
        forgetPrepaintLock(value).pipe(
          Effect.provide(keptStorage),
          Effect.catch((error) =>
            reportClientException(error, { source: "shell-prepaint-lock" })
          )
        )
      );
    };
  }, [name, until, value]);

  return hydrated ? null : <span data-shell-lock="" hidden />;
}

/**
 * Lets go of the lock the shell's script carried into the first frame once the
 * page has decided: its own lock holds the shell from then on, or nothing does.
 */
export function usePrepaintRelease(decided: boolean) {
  useLayoutEffect(() => {
    if (decided) {
      releasePrepaintLock(document);
    }
  }, [decided]);
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
