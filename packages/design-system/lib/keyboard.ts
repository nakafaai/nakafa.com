/**
 * Whether a key press is an Enter the learner means for the field, and not the
 * Enter that ends a composed character, such as the one that confirms a Japanese
 * conversion. Browsers report that Enter while the composition runs, with
 * `isComposing` set. Some Safari versions send it after the composition has
 * ended, with `isComposing` unset, and key code 229 is what browsers report for
 * a key press of an input method, so the key code is checked as well.
 */
export function isEnterOutsideComposition(
  event: Pick<KeyboardEvent, "isComposing" | "key" | "keyCode">
) {
  return event.key === "Enter" && !event.isComposing && event.keyCode !== 229;
}
