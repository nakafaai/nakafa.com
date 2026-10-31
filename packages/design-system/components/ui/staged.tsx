import { type ComponentProps, useLayoutEffect } from "react";

/** How many drawers are open on the page, since a drawer can open over another. */
let openDrawers = 0;

/**
 * The popup's element. While it is open it names on the root that a drawer is open, and the global styles
 * scale the page back from that name (`DrawerStage`). A rule on the root that looked for the open popup with
 * `:has()` would answer for every descendant, so each node that the page inserts would restyle the document.
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
    openDrawers += 1;
    root.toggleAttribute("data-drawer-open", true);
    return () => {
      openDrawers -= 1;
      root.toggleAttribute("data-drawer-open", openDrawers > 0);
    };
  }, [open]);

  return <div {...props} />;
}
