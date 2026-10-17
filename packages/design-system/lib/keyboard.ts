import { isComposingKey } from "@repo/utilities/composition";

/**
 * Whether a key press is the learner's own key press for the field, and not a
 * key that belongs to a composed character, such as the Enter that confirms a
 * Japanese conversion or the Escape that cancels it. The check, and why it also
 * reads the key code, is `isComposingKey`, the one owner of that rule.
 */
export function isOutsideComposition(
  event: Pick<KeyboardEvent, "isComposing" | "keyCode">
) {
  return !isComposingKey(event);
}

/**
 * Whether a key press is an Enter the learner means for the field, and not the
 * Enter of a composed character. See `isOutsideComposition`.
 */
export function isEnterOutsideComposition(
  event: Pick<KeyboardEvent, "isComposing" | "key" | "keyCode">
) {
  return event.key === "Enter" && isOutsideComposition(event);
}
