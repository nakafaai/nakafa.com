/**
 * The elements the learner types in or chooses a value in. A button, a link or a
 * region that is not editable is not one of them.
 */
const FIELD =
  "input, select, textarea, [contenteditable]:not([contenteditable='false'])";

/**
 * Puts the caret at the end of a new editor's text, unless the learner is typing
 * in a field of their own. The editor's code can arrive after the learner has
 * clicked the title, and the title keeps its focus then. A button or the body
 * holds no field, so the control that opened the editor hands its focus over.
 */
export function placeCaret(
  editor: { commands: { focus: (position: "end") => void } },
  active: Element | null
) {
  if (active?.matches(FIELD) === true) {
    return;
  }

  editor.commands.focus("end");
}
