import { focusIsLost } from "@repo/design-system/lib/focus";
import {
  isEnterOutsideComposition,
  isOutsideComposition,
} from "@repo/design-system/lib/keyboard";

/**
 * The keys of the box that renames a chat: Enter saves, and Escape closes the
 * box. The Enter that saves is consumed here. The save moves the focus to the
 * chat's menu trigger, and the same key press would otherwise reach that trigger
 * as a click, which opens the menu again. The Escape that cancels a composed
 * character belongs to the keyboard, as the Enter that confirms one does.
 */
export function handleTitleKeyDown(
  event: KeyboardEvent,
  actions: { close: () => void; save: () => void }
) {
  if (isEnterOutsideComposition(event)) {
    event.preventDefault();
    actions.save();
  }
  if (event.key === "Escape" && isOutsideComposition(event)) {
    actions.close();
  }
}

/**
 * Gives the focus to the control that opened the box, or to the title when that
 * control is gone. The focus moves only while it is lost, so a control the
 * learner chose keeps it.
 */
export function returnFocusAfterClose(
  box: HTMLElement | null,
  opener: HTMLElement | null,
  title: HTMLElement | null
) {
  if (focusIsLost(box)) {
    (opener ?? title)?.focus();
  }
}

/**
 * Gives the focus back to the box after a refused save brings the box back with
 * the words the learner wrote. The box takes the focus unless a control the
 * learner chose has it. The chat's menu, which the save gave the focus to, is
 * not such a control.
 */
export function focusBoxAfterRefusal(
  box: HTMLElement | null,
  moreActions: HTMLElement | null
) {
  if (focusIsLost(box) || document.activeElement === moreActions) {
    box?.focus();
  }
}
