// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { placeCaret } from "@repo/design-system/components/editor/caret";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";

/** How Safari on a Mac names itself, which Tiptap reads to focus the text at once. */
const SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

/** A new editor in the page, with the saved words of one memory. */
function openEditor() {
  const element = document.createElement("div");
  document.body.append(element);
  return new Editor({
    content: "<p>Studies after dinner</p>",
    editorProps: { attributes: { tabindex: "0" } },
    element,
    extensions: [StarterKit],
  });
}

/** Where the caret stands at the end of the editor's one paragraph. */
const endOf = (editor: Editor) => editor.state.doc.content.size - 1;

describe("caret", () => {
  beforeEach(() => {
    // jsdom lays nothing out, and the scroll to the caret measures a range of the text.
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [],
    });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("puts the caret at the end of a new editor and gives it the focus when no field has it", () => {
    for (const active of [
      null,
      document.createElement("button"),
      document.body,
    ]) {
      const editor = openEditor();

      placeCaret(editor, active);

      expect(editor.state.selection.from).toBe(endOf(editor));
      expect(document.activeElement).toBe(editor.view.dom);
      editor.destroy();
    }
  });

  it("keeps the caret where Safari changes the text as the text takes the focus", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(SAFARI);
    const editor = openEditor();
    // Safari writes into the text the moment it takes the focus.
    editor.view.dom.addEventListener("focus", () => {
      editor.view.dispatch(editor.state.tr.insertText("!", 1));
    });

    placeCaret(editor, document.body);

    expect(editor.getText()).toBe("!Studies after dinner");
    expect(editor.state.selection.from).toBe(endOf(editor));
  });

  it("leaves the caret alone while the learner types in a field of their own", () => {
    const editor = openEditor();
    const before = editor.state.selection;
    const title = document.createElement("input");
    const select = document.createElement("select");
    const area = document.createElement("textarea");
    const words = document.createElement("div");
    words.setAttribute("contenteditable", "true");

    for (const field of [title, select, area, words]) {
      placeCaret(editor, field);
    }

    expect(editor.state.selection.eq(before)).toBe(true);
    expect(document.activeElement).not.toBe(editor.view.dom);
  });
});
