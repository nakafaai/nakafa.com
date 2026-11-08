// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { objectKeys } from "@repo/design-system/components/editor/objects";
import { type DocumentRules, documentExtensions } from "@repo/editor/document";
import { Editor, type JSONContent } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { Array as Arr } from "effect";

/** The rules of a test document: the marks and headings do not matter to its objects. */
const RULES: DocumentRules = {
  headingLevels: [1, 2, 3],
  isLinkAllowed: () => true,
  marks: ["bold"],
};

const paragraph = (text: string): JSONContent =>
  text === ""
    ? { type: "paragraph" }
    : { content: [{ text, type: "text" }], type: "paragraph" };

const cell = (
  type: "tableCell" | "tableHeader",
  text: string
): JSONContent => ({
  content: [paragraph(text)],
  type,
});

/** A table of a header row and a body row of two cells each, holding the given words. */
const table = (
  words: readonly [string, string, string, string]
): JSONContent => ({
  content: [
    {
      content: [cell("tableHeader", words[0]), cell("tableHeader", words[1])],
      type: "tableRow",
    },
    {
      content: [cell("tableCell", words[2]), cell("tableCell", words[3])],
      type: "tableRow",
    },
  ],
  type: "table",
});

const EMPTY_TABLE = table(["", "", "", ""]);

/** An editable editor of the document's objects, drawn into a page so its keys reach it. */
function openEditor(content: readonly JSONContent[]) {
  return new Editor({
    content: { content: [...content], type: "doc" },
    element: document.createElement("div"),
    extensions: [...documentExtensions(RULES), objectKeys],
  });
}

/** Presses a key in the editor, as the browser hands it over, and says whether a key handler took it. */
function press(editor: Editor, key: string) {
  const event = new KeyboardEvent("keydown", { bubbles: true, key });
  return (
    editor.view.someProp("handleKeyDown", (handle) =>
      handle(editor.view, event)
    ) ?? false
  );
}

/** The position of the first text node that reads `text`. */
function textAt(editor: Editor, text: string) {
  let position = -1;
  editor.state.doc.descendants((node, at) => {
    if (position === -1 && node.text === text) {
      position = at;
    }
  });
  return position;
}

/** The position of the first node of `type`, or of the last one with `last`. */
function nodeAt(editor: Editor, type: string, last = false) {
  let position = -1;
  editor.state.doc.descendants((node, at) => {
    if ((last || position === -1) && node.type.name === type) {
      position = at;
    }
  });
  return position;
}

/** The types of the blocks of the document, in order. */
const blocks = (editor: Editor) =>
  Arr.map(editor.state.doc.children, (node) => node.type.name);

describe("editor/objects removing a table", () => {
  it.each(["Backspace", "Delete"])(
    "removes a table that holds nothing with %s, from the caret in any of its cells",
    (key) => {
      const editor = openEditor([paragraph("Soal"), EMPTY_TABLE]);
      // The caret stands in the paragraph of the body row's last cell.
      editor.commands.setTextSelection(nodeAt(editor, "tableCell", true) + 2);
      expect(press(editor, key)).toBe(true);
      // The editor keeps a line after the last block, which stays.
      expect(blocks(editor)).toEqual(["paragraph", "paragraph"]);
      editor.destroy();
    }
  );

  it("keeps a table whose cells hold words, and leaves the press to the browser, which deletes a letter of the cell", () => {
    const editor = openEditor([table(["A", "B", "1", "2"])]);
    editor.commands.setTextSelection(textAt(editor, "1") + 1);
    expect(press(editor, "Backspace")).toBe(false);
    expect(blocks(editor)).toEqual(["table", "paragraph"]);
    editor.destroy();
  });

  it("leaves a range of text to the editor's own keys, which delete the range and keep the table", () => {
    const editor = openEditor([paragraph("Soal"), EMPTY_TABLE]);
    editor.commands.setTextSelection({ from: 1, to: 3 });
    press(editor, "Backspace");
    expect(editor.state.doc.child(0).textContent).toBe("al");
    expect(blocks(editor)).toEqual(["paragraph", "table", "paragraph"]);
    editor.destroy();
  });

  it("removes a table whose every cell is selected with Backspace, through the table's own keys", () => {
    const editor = openEditor([paragraph("Soal"), table(["A", "B", "1", "2"])]);
    editor.view.dispatch(
      editor.state.tr.setSelection(
        CellSelection.create(
          editor.state.doc,
          nodeAt(editor, "tableHeader"),
          nodeAt(editor, "tableCell", true)
        )
      )
    );
    expect(press(editor, "Backspace")).toBe(true);
    expect(blocks(editor)).toEqual(["paragraph", "paragraph"]);
    editor.destroy();
  });
});

describe("editor/objects outside a table", () => {
  it("lets Backspace pass in text beside a table, so the press deletes a letter as usual", () => {
    const editor = openEditor([paragraph("Soal"), EMPTY_TABLE]);
    editor.commands.setTextSelection(3);
    expect(press(editor, "Backspace")).toBe(false);
    expect(blocks(editor)).toEqual(["paragraph", "table", "paragraph"]);
    editor.destroy();
  });
});

describe("editor/objects leaving an object", () => {
  it("puts the caret at the start of the text after a table, with Escape from a cell", () => {
    const editor = openEditor([EMPTY_TABLE, paragraph("Lanjut")]);
    editor.commands.setTextSelection(nodeAt(editor, "tableHeader") + 2);
    expect(press(editor, "Escape")).toBe(true);
    const { selection } = editor.state;
    expect(selection).toBeInstanceOf(TextSelection);
    expect(selection.$from.parent.textContent).toBe("Lanjut");
    expect(selection.$from.parentOffset).toBe(0);
    editor.destroy();
  });

  it("puts the caret in the line the editor keeps after a table that ends the document", () => {
    const editor = openEditor([paragraph("Soal"), EMPTY_TABLE]);
    editor.commands.setTextSelection(nodeAt(editor, "tableHeader") + 2);
    expect(press(editor, "Escape")).toBe(true);
    expect(blocks(editor)).toEqual(["paragraph", "table", "paragraph"]);
    expect(editor.state.selection.$from.parent).toBe(
      editor.state.doc.lastChild
    );
    editor.destroy();
  });

  it("puts the caret just after a selected inline formula, in its line", () => {
    const editor = openEditor([
      {
        content: [
          { text: "a ", type: "text" },
          { attrs: { latex: "x^2" }, type: "mathInline" },
          { text: " b", type: "text" },
        ],
        type: "paragraph",
      },
    ]);
    const formula = nodeAt(editor, "mathInline");
    editor.view.dispatch(
      editor.state.tr.setSelection(
        NodeSelection.create(editor.state.doc, formula)
      )
    );
    expect(press(editor, "Escape")).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(TextSelection);
    expect(editor.state.selection.from).toBe(formula + 1);
    editor.destroy();
  });

  it("keeps the caret in the cell of a selected picture, under the picture", () => {
    const editor = openEditor([
      {
        content: [
          {
            content: [
              {
                content: [
                  {
                    attrs: { alt: "Grafik", asset: "a", height: 10, width: 10 },
                    type: "image",
                  },
                ],
                type: "tableCell",
              },
            ],
            type: "tableRow",
          },
        ],
        type: "table",
      },
    ]);
    editor.view.dispatch(
      editor.state.tr.setSelection(
        NodeSelection.create(editor.state.doc, nodeAt(editor, "image"))
      )
    );
    expect(press(editor, "Escape")).toBe(true);
    const { $from } = editor.state.selection;
    expect($from.parent.type.name).toBe("paragraph");
    expect($from.node($from.depth - 1).type.name).toBe("tableCell");
    expect(blocks(editor)).toEqual(["table", "paragraph"]);
    editor.destroy();
  });

  it("leaves a selected formula block for the text after it", () => {
    const editor = openEditor([
      { attrs: { latex: "x" }, type: "mathBlock" },
      paragraph("Lanjut"),
    ]);
    editor.view.dispatch(
      editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0))
    );
    expect(press(editor, "Escape")).toBe(true);
    expect(editor.state.selection.$from.parent.textContent).toBe("Lanjut");
    editor.destroy();
  });

  it("lets Escape pass in text that holds no object", () => {
    const editor = openEditor([paragraph("Soal")]);
    editor.commands.setTextSelection(2);
    expect(press(editor, "Escape")).toBe(false);
    expect(editor.state.selection.from).toBe(2);
    editor.destroy();
  });
});
