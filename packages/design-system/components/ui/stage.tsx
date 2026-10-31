import type { ReactNode } from "react";

/**
 * The page a drawer opens over, wrapping the whole app once at its root. On a phone, while a drawer is
 * open, the page scales back behind it as an iPhone sheet does; the design system's global styles draw
 * that from the open drawer's popup, so the stage holds no state and changes no value above streamed
 * content. It lives apart from the drawer, so the root's first JavaScript holds none of the drawer.
 *
 * A signed-in screen renders only in the browser, so its first HTML holds no page and the stage stands
 * empty until the scripts arrive. On a slow phone that is seconds of a blank screen, so an empty stage
 * draws a loader in pure CSS, which needs no script. It shows only after 400 ms, so a fast page never
 * flashes it, and it goes by itself with the first element React draws.
 */
export function DrawerStage({ children }: { children: ReactNode }) {
  return (
    <div
      className="empty:after:border-muted-foreground empty:after:fixed empty:after:start-1/2 empty:after:top-1/2 empty:after:size-6 empty:after:-translate-1/2 empty:after:animate-spin empty:after:rounded-full empty:after:border-2 empty:after:border-t-transparent empty:after:transition-opacity empty:after:delay-400 starting:empty:after:opacity-0"
      data-slot="drawer-stage"
    >
      {children}
    </div>
  );
}
