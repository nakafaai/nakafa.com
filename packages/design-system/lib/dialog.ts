import { isEnterOutsideComposition } from "@repo/design-system/lib/keyboard";
import { Array as Arr } from "effect";
import type { KeyboardEvent } from "react";

/** The input types that hold a line of text to finish. A search only filters what its dialog shows, so it stays out. */
const LINE_TYPES = ["email", "number", "password", "tel", "text", "url"];

/**
 * Presses a dialog's main action on an Enter in a one-line field, as a form takes it for its submit button: the
 * footer's last child is the main action of every dialog, a disabled one stays unpressed, and a footer that ends in
 * anything else keeps the Enter. A field that takes its own Enter, such as a combobox, or a popup that reached this
 * handler through a portal keeps it too.
 */
export function pressMainAction(
  event: Pick<
    KeyboardEvent<HTMLElement>,
    | "currentTarget"
    | "defaultPrevented"
    | "nativeEvent"
    | "preventDefault"
    | "target"
  >,
  footer: HTMLElement | null
) {
  const { currentTarget, defaultPrevented, nativeEvent, target } = event;

  if (defaultPrevented || !isEnterOutsideComposition(nativeEvent)) {
    return;
  }
  if (
    !(
      target instanceof HTMLInputElement &&
      currentTarget.contains(target) &&
      Arr.contains(LINE_TYPES, target.type) &&
      target.getAttribute("role") !== "combobox"
    )
  ) {
    return;
  }

  const main = footer?.lastElementChild;

  if (main instanceof HTMLButtonElement) {
    event.preventDefault();
    main.click();
  }
}
