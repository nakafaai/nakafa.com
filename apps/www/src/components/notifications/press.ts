import { Schema } from "effect";

/**
 * Where a press on an invitation row takes the learner: to the school's home in the
 * same tab, once the row is read, or to the browser, which opens the link the way it
 * opens any other link.
 */
const NavigationTarget = Schema.Literals(["browser", "same-tab"]);
/** Where a press on an invitation row takes the learner. */
type NavigationTarget = typeof NavigationTarget.Type;

/**
 * The target of one press. A plain press, with the primary button and no modifier
 * key, stays in the same tab. A modifier key, or any other button, leaves the link to
 * the browser, so the link opens in a new tab or window as the browser opens it.
 */
export function navigationOf(
  press: Pick<
    MouseEvent,
    "altKey" | "button" | "ctrlKey" | "metaKey" | "shiftKey"
  >
): NavigationTarget {
  const isPlain =
    press.button === 0 &&
    !press.altKey &&
    !press.ctrlKey &&
    !press.metaKey &&
    !press.shiftKey;
  return isPlain ? "same-tab" : "browser";
}
