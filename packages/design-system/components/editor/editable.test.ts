// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { editableState } from "@repo/design-system/components/editor/editable";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";

/** A mounted editor that starts read-only, as the synced document editor does. */
function openEditor() {
  return new Editor({
    editable: false,
    element: document.createElement("div"),
    extensions: [StarterKit, editableState],
  });
}

describe("editableState", () => {
  it("marks a read-only editor as read-only, though it keeps the textbox role", () => {
    const editor = openEditor();
    expect(editor.view.dom.getAttribute("role")).toBe("textbox");
    expect(editor.view.dom.getAttribute("aria-readonly")).toBe("true");
    editor.destroy();
  });

  it("follows the editor once editing is turned on, and off again", () => {
    const editor = openEditor();
    editor.setEditable(true);
    expect(editor.view.dom.getAttribute("aria-readonly")).toBe("false");
    editor.setEditable(false);
    expect(editor.view.dom.getAttribute("aria-readonly")).toBe("true");
    editor.destroy();
  });
});
