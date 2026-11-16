// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { documentExtensions } from "@repo/editor/document";
import {
  formulaTokenizer,
  NEW_FORMULA,
  parseFormula,
  renderBlockFormula,
  renderInlineFormula,
} from "@repo/editor/math";
import {
  Editor,
  findChildren,
  type MarkdownLexerConfiguration,
} from "@tiptap/core";
import { Array as Arr, Option } from "effect";

/** A headless editor of a document with the given HTML, as the exam editor holds one. */
function openEditor(html: string) {
  return new Editor({
    content: html,
    element: document.createElement("div"),
    extensions: documentExtensions({
      headingLevels: [1, 2, 3],
      isLinkAllowed: () => false,
      marks: ["bold"],
    }),
  });
}

/** The names of the nodes inside the first block of the document. */
function firstBlockNodes(editor: Editor) {
  const block = editor.state.doc.child(0);
  return Arr.makeBy(block.childCount, (index) => block.child(index).type.name);
}

/** The block formulas of the document, each with its position. */
function blockFormulas(editor: Editor) {
  return findChildren(
    editor.state.doc,
    (node) => node.type.name === "mathBlock"
  );
}

/** The text that the editor has selected. */
function selectedText(editor: Editor) {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to);
}

/** Presses a key with Ctrl held, which a test browser reads as Mod, on the editor's view. */
function press(editor: Editor, init: KeyboardEventInit) {
  editor.view.someProp("handleKeyDown", (handle) =>
    handle(
      editor.view,
      new KeyboardEvent("keydown", { ...init, ctrlKey: true })
    )
  );
}

describe("toggleFormula", () => {
  it("turns the selected text into inline math with the text as its LaTeX, and the formula back into selected text", () => {
    const editor = openEditor("<p>Hitung x^2 saja</p>");
    editor.commands.setTextSelection({ from: 8, to: 11 });
    editor.commands.toggleFormula("mathInline");
    expect(firstBlockNodes(editor)).toEqual(["text", "mathInline", "text"]);
    expect(editor.state.doc.child(0).child(1).attrs).toEqual({ latex: "x^2" });
    expect(Option.isNone(editor.storage.formulaToggle.opening)).toBe(true);

    editor.commands.setNodeSelection(8);
    editor.commands.toggleFormula("mathInline");
    expect(editor.getText()).toBe("Hitung x^2 saja");
    expect(selectedText(editor)).toBe("x^2");
  });

  it("opens a formula inserted in bold text, which takes no mark, so its editor knows it", () => {
    const editor = openEditor("<p><strong>Luas</strong> persegi</p>");
    editor.commands.setTextSelection(1);
    editor.commands.toggleFormula("mathInline");
    const inserted = editor.state.doc.child(0).child(0);
    expect(inserted.type.name).toBe("mathInline");
    expect(inserted.marks).toEqual([]);
    expect(
      Option.exists(
        editor.storage.formulaToggle.opening,
        (opening) => opening === inserted
      )
    ).toBe(true);
  });

  it("turns the selected text into block math, and the block back into a paragraph of its selected LaTeX", () => {
    const editor = openEditor("<p>a+b</p>");
    editor.commands.setTextSelection({ from: 1, to: 4 });
    editor.commands.toggleFormula("mathBlock");
    const formulas = blockFormulas(editor);
    expect(Arr.map(formulas, ({ node }) => node.attrs)).toEqual([
      { latex: "a+b" },
    ]);

    editor.commands.setNodeSelection(
      Option.getOrThrow(Arr.head(Arr.map(formulas, ({ pos }) => pos)))
    );
    editor.commands.toggleFormula("mathBlock");
    expect(blockFormulas(editor)).toEqual([]);
    expect(editor.getText()).toContain("a+b");
    expect(selectedText(editor)).toBe("a+b");
  });

  it("inserts a new formula with nothing selected, and marks it as the one whose editor opens", () => {
    const editor = openEditor("<p>Hitung </p>");
    editor.commands.setTextSelection(8);
    editor.commands.toggleFormula("mathInline");
    const inserted = editor.state.doc.child(0).child(1);
    expect(inserted.attrs).toEqual({ latex: NEW_FORMULA });
    expect(
      Option.exists(
        editor.storage.formulaToggle.opening,
        (opening) => opening === inserted
      )
    ).toBe(true);
  });

  it("turns a formula with no LaTeX into no text at all", () => {
    const editor = openEditor('<p>a<span data-type="math-inline"></span>b</p>');
    editor.commands.setNodeSelection(2);
    editor.commands.toggleFormula("mathInline");
    expect(firstBlockNodes(editor)).toEqual(["text"]);
    expect(editor.getText()).toBe("ab");
  });

  it("answers that it can run without changing the document", () => {
    const editor = openEditor("<p>x</p>");
    expect(editor.can().toggleFormula("mathInline")).toBe(true);
    expect(firstBlockNodes(editor)).toEqual(["text"]);
  });

  it("runs from Mod-Shift-E for inline math and Mod-Alt-E for block math", () => {
    const inline = openEditor("<p>y</p>");
    inline.commands.setTextSelection({ from: 1, to: 2 });
    press(inline, { key: "e", shiftKey: true });
    expect(firstBlockNodes(inline)).toEqual(["mathInline"]);

    const block = openEditor("<p>z</p>");
    block.commands.setTextSelection({ from: 1, to: 2 });
    press(block, { altKey: true, key: "e" });
    expect(Arr.map(blockFormulas(block), ({ node }) => node.attrs)).toEqual([
      { latex: "z" },
    ]);
  });
});

/** A lexer the tokenizers never call: a formula holds no Markdown of its own. */
const NO_LEXER: MarkdownLexerConfiguration = {
  blockTokens: () => [],
  inlineTokens: () => [],
};

describe("formula Markdown", () => {
  it("reads an inline formula between two pairs of dollars, and finds where one starts", () => {
    const inline = formulaTokenizer("mathInline");
    expect(inline.level).toBe("inline");
    expect(typeof inline.start === "function" && inline.start("a $$x$$")).toBe(
      2
    );
    expect(inline.tokenize("$$ x^2 $$ lalu", [], NO_LEXER)).toEqual({
      latex: "x^2",
      raw: "$$ x^2 $$",
      type: "mathInline",
    });
  });

  it("reads a math fence on a line of its own as a block formula", () => {
    const block = formulaTokenizer("mathBlock");
    expect(block.level).toBe("block");
    expect(
      block.tokenize("```math\n\\frac{a}{b}\n```\nsisa", [], NO_LEXER)
    ).toEqual({
      latex: "\\frac{a}{b}",
      raw: "```math\n\\frac{a}{b}\n```\n",
      type: "mathBlock",
    });
  });

  it("reads no formula from blank LaTeX or from text that holds none", () => {
    const inline = formulaTokenizer("mathInline");
    expect(inline.tokenize("$$ $$", [], NO_LEXER)).toBeUndefined();
    expect(inline.tokenize("harga $5", [], NO_LEXER)).toBeUndefined();
  });

  it("makes a token its node, and writes each node as the Markdown its tokenizer reads", () => {
    expect(
      parseFormula("mathInline")({ latex: "x", type: "mathInline" })
    ).toEqual({
      attrs: { latex: "x" },
      type: "mathInline",
    });
    const inline = renderInlineFormula({
      attrs: { latex: "x^2" },
      type: "mathInline",
    });
    const block = renderBlockFormula({
      attrs: { latex: "\\sqrt{2}" },
      type: "mathBlock",
    });
    expect(inline).toBe("$$x^2$$");
    expect(block).toBe("```math\n\\sqrt{2}\n```");
    expect(
      formulaTokenizer("mathInline").tokenize(inline, [], NO_LEXER)
    ).toMatchObject({ latex: "x^2" });
    expect(
      formulaTokenizer("mathBlock").tokenize(block, [], NO_LEXER)
    ).toMatchObject({ latex: "\\sqrt{2}" });
  });
});
