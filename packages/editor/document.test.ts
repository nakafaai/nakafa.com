// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import {
  type DocumentRules,
  documentExtensions,
  documentSchema,
} from "@repo/editor/document";
import { Editor } from "@tiptap/core";
import { Array as Arr, Record as Rec } from "effect";

/** The rules of the tests: headings of levels 1 to 3, and links to https addresses only. */
const RULES = {
  headingLevels: [1, 2, 3],
  isLinkAllowed: (href: string) => href.startsWith("https://"),
} satisfies Omit<DocumentRules, "marks">;

/**
 * Pastes text at the caret the way the browser does, as a transaction that the view marks as
 * a paste, so the paste rules run. jsdom has no clipboard event, so the mark is set directly.
 */
function paste(editor: Editor, text: string) {
  editor.view.dispatch(
    editor.state.tr.insertText(text).setMeta("uiEvent", "paste")
  );
}

/** A headless editor that holds a document of the test rules, with the marks it is given. */
function openEditor(marks: DocumentRules["marks"]) {
  return new Editor({
    element: document.createElement("div"),
    extensions: documentExtensions({ ...RULES, marks }),
  });
}

describe("documentSchema", () => {
  it("holds exactly the marks it is given, in the order it is given them", () => {
    const schema = documentSchema({
      ...RULES,
      marks: [
        "bold",
        "italic",
        "underline",
        "code",
        "subscript",
        "superscript",
        "link",
      ],
    });
    expect(Rec.keys(schema.marks)).toEqual([
      "bold",
      "italic",
      "underline",
      "code",
      "subscript",
      "superscript",
      "link",
    ]);
  });

  it("holds a link's address and an ordered list's start, and no other attribute", () => {
    const schema = documentSchema({ ...RULES, marks: ["link"] });
    expect(
      schema.marks.link.create({ href: "https://nakafa.com" }).toJSON()
    ).toEqual({ attrs: { href: "https://nakafa.com" }, type: "link" });
    expect(schema.nodes.orderedList.create({ start: 3 }).toJSON()).toEqual({
      attrs: { start: 3 },
      type: "orderedList",
    });
  });

  it("reads a pasted ordered list's start as a number, and drops its list style", () => {
    const editor = openEditor([]);
    editor.commands.setContent('<ol start="3" type="a"><li><p>x</p></li></ol>');
    expect(editor.getJSON().content?.[0]?.attrs).toEqual({ start: 3 });
    editor.commands.setContent("<ol><li><p>x</p></li></ol>");
    expect(editor.getJSON().content?.[0]?.attrs).toEqual({ start: 1 });
  });

  it("reads a pasted link's address, and holds no other attribute", () => {
    const editor = openEditor(["link"]);
    editor.commands.setContent(
      '<p><a href="https://nakafa.com" target="_blank">x</a></p>'
    );
    expect(editor.getJSON().content?.[0]?.content?.[0]?.marks).toEqual([
      { attrs: { href: "https://nakafa.com" }, type: "link" },
    ]);
  });

  it("offers no strike and no highlight, and ranks link after bold when the list gives bold first", () => {
    const schema = documentSchema({ ...RULES, marks: ["bold", "link"] });
    expect(Rec.keys(schema.marks)).toEqual(["bold", "link"]);
  });

  it("follows the list when the list gives link first", () => {
    const schema = documentSchema({ ...RULES, marks: ["link", "bold"] });
    expect(Rec.keys(schema.marks)).toEqual(["link", "bold"]);
  });
});

describe("documentExtensions", () => {
  it("offers only the heading levels its rules give", () => {
    const editor = openEditor([]);
    expect(editor.can().setHeading({ level: 3 })).toBe(true);
    expect(editor.can().setHeading({ level: 4 })).toBe(false);
  });

  it("holds no horizontal rule, because a document of its kind holds none", () => {
    const editor = openEditor([]);
    expect(Rec.keys(editor.schema.nodes)).not.toContain("horizontalRule");
  });

  it("refuses a link to an address its rules refuse, and takes one they allow", () => {
    const editor = openEditor(["link"]);
    editor.commands.setContent("<p>Nakafa</p>");
    editor.commands.setTextSelection({ from: 1, to: 7 });
    expect(editor.can().setLink({ href: "http://nakafa.com" })).toBe(false);
    expect(editor.can().setLink({ href: "https://nakafa.com" })).toBe(true);
  });
});

describe("documentSchema blocks and tables", () => {
  const schema = documentSchema({ ...RULES, marks: ["bold", "link"] });

  it("holds the blocks of the contract that the editor writes", () => {
    expect(Rec.keys(schema.nodes)).toEqual(
      expect.arrayContaining([
        "blockquote",
        "bulletList",
        "codeBlock",
        "hardBreak",
        "heading",
        "listItem",
        "orderedList",
        "paragraph",
        "table",
        "tableCell",
        "tableHeader",
        "tableRow",
      ])
    );
  });

  it("round-trips the blocks of the contract as their JSON", () => {
    const blocks = [
      {
        attrs: { language: "ts" },
        content: [{ text: "const a = 1", type: "text" }],
        type: "codeBlock",
      },
      { attrs: { language: null }, type: "codeBlock" },
      {
        content: [
          {
            content: [{ text: "kutipan", type: "text" }],
            type: "paragraph",
          },
        ],
        type: "blockquote",
      },
      {
        content: [
          {
            content: [
              { content: [{ text: "satu", type: "text" }], type: "paragraph" },
              {
                content: [
                  {
                    content: [{ text: "catatan", type: "text" }],
                    type: "paragraph",
                  },
                ],
                type: "blockquote",
              },
            ],
            type: "listItem",
          },
        ],
        attrs: { start: 3 },
        type: "orderedList",
      },
    ];
    for (const block of blocks) {
      expect(schema.nodeFromJSON(block).toJSON()).toEqual(block);
    }
  });

  it("round-trips a table of header and body cells, each with its spans", () => {
    const cell = (type: "tableCell" | "tableHeader", text: string) => ({
      attrs: { colspan: 1, rowspan: 1 },
      content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
      type,
    });
    const table = {
      content: [
        {
          content: [cell("tableHeader", "Nama"), cell("tableHeader", "Nilai")],
          type: "tableRow",
        },
        {
          content: [cell("tableCell", "Budi"), cell("tableCell", "90")],
          type: "tableRow",
        },
      ],
      type: "table",
    };
    expect(schema.nodeFromJSON(table).toJSON()).toEqual(table);
  });

  it("refuses a row with no cell, as the contract does", () => {
    expect(() => schema.nodes.tableRow.create(null, []).check()).toThrow();
  });

  it("holds the spans of a pasted cell, reads a missing span as 1, and drops its column width", () => {
    const editor = openEditor(["bold"]);
    editor.commands.setContent(
      '<table><tbody><tr><td colspan="2" rowspan="0" style="width: 120px">x</td><td>y</td></tr></tbody></table>'
    );
    const row = editor.state.doc.firstChild?.firstChild;
    const spans = Arr.makeBy(
      row?.childCount ?? 0,
      (index) => row?.child(index).attrs
    );
    expect(spans).toEqual([
      { colspan: 2, rowspan: 1 },
      { colspan: 1, rowspan: 1 },
    ]);
  });
});

describe("documentSchema math", () => {
  const schema = documentSchema({ ...RULES, marks: ["bold"] });

  it("round-trips inline and block math as their JSON, with the LaTeX as the one attribute", () => {
    const paragraph = {
      content: [
        { text: "Rumus ", type: "text" },
        { attrs: { latex: "x^2" }, type: "mathInline" },
      ],
      type: "paragraph",
    };
    const block = { attrs: { latex: "\\frac{a}{b}" }, type: "mathBlock" };
    expect(schema.nodeFromJSON(paragraph).toJSON()).toEqual(paragraph);
    expect(schema.nodeFromJSON(block).toJSON()).toEqual(block);
  });

  it("reads the LaTeX of a pasted formula from its DOM, and reads a formula with none as blank", () => {
    const editor = openEditor([]);
    editor.commands.setContent(
      '<p><span data-type="math-inline" data-latex="x^2"></span><span data-type="math-inline"></span></p><div data-type="math-block" data-latex="a+b"></div>'
    );
    const paragraph = editor.state.doc.child(0);
    expect(
      Arr.makeBy(paragraph.childCount, (index) => paragraph.child(index).attrs)
    ).toEqual([{ latex: "x^2" }, { latex: "" }]);
    const block = editor.state.doc.child(1);
    expect(block.type.name).toBe("mathBlock");
    expect(block.attrs).toEqual({ latex: "a+b" });
  });

  it("converts the formulas of a pasted text into formula nodes where the paste lands", () => {
    const editor = openEditor([]);
    editor.commands.setContent("<p></p>");
    paste(editor, "Hitung $x^2$ saja");
    const paragraph = editor.state.doc.child(0);
    expect(
      Arr.makeBy(
        paragraph.childCount,
        (index) => paragraph.child(index).type.name
      )
    ).toEqual(["text", "mathInline", "text"]);
    expect(paragraph.child(1).attrs).toEqual({ latex: "x^2" });
  });

  it("converts a pasted block formula into a block of its own", () => {
    const editor = openEditor([]);
    editor.commands.setContent("<p></p>");
    paste(editor, "$$a+b$$");
    const top = editor.state.doc;
    expect(
      Arr.makeBy(top.childCount, (index) => top.child(index).type.name)
    ).toContain("mathBlock");
  });
});
