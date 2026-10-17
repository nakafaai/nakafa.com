/**
 * Says whether a key press belongs to an input method that is still choosing
 * characters, so the page must not act on it. The key that closes a composition
 * can arrive after `compositionend` with `isComposing` false, as Enter does in
 * Safari, and it still carries `keyCode` 229, so both are checked.
 */
export function isComposingKey(
  event: Pick<KeyboardEvent, "isComposing" | "keyCode">
): boolean {
  return event.isComposing || event.keyCode === 229;
}
