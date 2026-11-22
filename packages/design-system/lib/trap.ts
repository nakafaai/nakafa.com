import type { KeyboardEvent } from "react";

/**
 * Keeps a Tab inside a modal popup in Safari. A key handler of the popup's content: the dialog, the drawer and the
 * modal sheet carry it. UI SDK traps the focus at the popup's two ends, as its own list of stops orders them, and
 * leaves every Tab in between to the browser. Safari's own order skips buttons, so a Tab from the last field it stops
 * on passes every button after it, finds nothing in the page, which is inert, and leaves the focus on the body
 * (https://github.com/vercel-labs/ui/issues/1018). When a Tab drops the focus on the body, the popup takes it back
 * itself, as it holds it when it opens: the next Tab enters it at its first stop, and Shift+Tab wraps to its last.
 */
export function keepTabInside(
  event: Pick<
    KeyboardEvent<HTMLElement>,
    "currentTarget" | "defaultPrevented" | "key"
  >
) {
  if (event.key !== "Tab" || event.defaultPrevented) {
    return;
  }
  const popup = event.currentTarget;
  // A focus that moves on to an element names it; one that falls on the body names none.
  const left = (out: FocusEvent) => {
    if (out.relatedTarget === null && popup.isConnected) {
      popup.focus({ preventScroll: true });
    }
  };
  // The browser moves the focus as the key's default action, right after this handler: the watch ends with that move.
  popup.addEventListener("focusout", left, { once: true });
}
