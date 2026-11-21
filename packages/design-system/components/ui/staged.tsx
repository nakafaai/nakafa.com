import type { ComponentProps } from "react";
import { useLayoutEffect } from "react";

/** How many drawers are open on the page, since a drawer can open over another. */
let openDrawers = 0;

/**
 * The element of a sheet: a drawer, or a dialog that rises as one on a phone. While it is open it names on the root
 * that a sheet is open, and the global styles scale the page back from that name (`DrawerStage`), from where the page
 * was scrolled as it opened: the scroll lock then moves the scroll from the root to the body, so the larger of the two
 * is the page's, and the value stays while the page scales back up. A rule on the root that looked for the open
 * sheet with `:has()` would answer for every descendant, so each node that the page inserts would restyle the
 * document.
 */
export function StagedPopup({
  open,
  ...props
}: ComponentProps<"div"> & { open: boolean }) {
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty(
      "--drawer-stage-scroll",
      `${Math.max(root.scrollTop, document.body.scrollTop)}px`
    );
    openDrawers += 1;
    root.toggleAttribute("data-drawer-open", true);
    return () => {
      openDrawers -= 1;
      root.toggleAttribute("data-drawer-open", openDrawers > 0);
    };
  }, [open]);

  return <div {...props} />;
}
