/**
 * Types `text` into a text field at its caret, as a key press would: the text replaces the selected
 * words, the caret follows it, and an input event tells the page, so a field that React controls
 * reads its new value through its change handler. A field that reports no caret takes the text at
 * its end. The on-screen Arabic keypad of a player types with it, and the field keeps its focus.
 */
export function typeIntoField(
  field: HTMLInputElement | HTMLTextAreaElement,
  text: string
) {
  field.setRangeText(
    text,
    field.selectionStart ?? field.value.length,
    field.selectionEnd ?? field.value.length,
    "end"
  );
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
