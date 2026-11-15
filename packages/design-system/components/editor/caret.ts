import type { Editor } from "@tiptap/core";

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
 *
 * The caret is set by a transaction of its own before the text takes the focus.
 * Tiptap's `focus` command focuses the text in Safari while it holds a
 * transaction it has not dispatched yet, and Safari changes the document as the
 * text takes the focus, so that transaction no longer fits the document and
 * ProseMirror refuses it.
 */
export function placeCaret(
  editor: Pick<Editor, "commands" | "state" | "view">,
  active: Element | null
) {
  if (active?.matches(FIELD) === true) {
    return;
  }

  editor.commands.setTextSelection(editor.state.doc.content.size);
  editor.view.focus();
  editor.commands.scrollIntoView();
}
