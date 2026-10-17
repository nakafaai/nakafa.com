import { isEnterOutsideComposition } from "@repo/design-system/lib/keyboard";

/**
 * The keys of the box that renames a chat: Enter saves, and Escape closes the
 * box. The Enter that saves is consumed here. The save moves the focus to the
 * chat's menu trigger, and the same key press would otherwise reach that trigger
 * as a click, which opens the menu again.
 */
export function handleTitleKeyDown(
  event: KeyboardEvent,
  actions: { close: () => void; save: () => void }
) {
  if (isEnterOutsideComposition(event)) {
    event.preventDefault();
    actions.save();
  }
  if (event.key === "Escape") {
    actions.close();
  }
}
