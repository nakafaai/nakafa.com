// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import { richOptions } from "@repo/design-system/components/editor/extensions";
import { Editor, type JSONContent } from "@tiptap/core";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { Array as Arr } from "effect";

/** The editor of a memory with a document to render in, with the limit and the refusal a test names. */
function openEditor(
  content: JSONContent | string,
  { limit = 100_000, onRefuse = vi.fn<() => void>() } = {}
) {
  return new Editor({
    ...richOptions({ limit, onRefuse, placeholder: "" }),
    content,
    ...(typeof content === "string"
      ? { contentType: "markdown" as const }
      : {}),
    element: null,
  });
}

const paragraph = (value: string): JSONContent => ({
  content: [{ text: value, type: "text" }],
  type: "paragraph",
});

/** One document with every kind of block, and words that a Markdown writer must treat with care. */
const DOC: JSONContent = {
  content: [
    paragraph("C++ and Q&A **bold** `tick` [x] ~y~ _z_"),
    {
      attrs: { level: 2 },
      content: [{ text: "نور الهدى", type: "text" }],
      type: "heading",
    },
    {
      content: [
        {
          content: [paragraph("نور الهدى"), paragraph("two")],
          type: "listItem",
        },
      ],
      type: "bulletList",
    },
    {
      attrs: { start: 3 },
      content: [{ content: [paragraph("نور الهدى")], type: "listItem" }],
      type: "orderedList",
    },
    {
      content: [
        {
          attrs: { checked: true },
          content: [paragraph("done")],
          type: "taskItem",
        },
      ],
      type: "taskList",
    },
    { content: [paragraph("日本語")], type: "blockquote" },
    {
      attrs: { language: "ts" },
      content: [{ text: "a < b", type: "text" }],
      type: "codeBlock",
    },
    { type: "horizontalRule" },
  ],
  type: "doc",
};

/**
 * Applies one edit to a state that holds the plugins of the editor, the way
 * the editor's view does, and says whether the editor's plugins let it pass.
 * An editor with no page has no view, so its own state holds no plugins.
 */
function passes(
  editor: Editor,
  edit: (transaction: Transaction) => Transaction
) {
  const state = EditorState.create({
    doc: editor.state.doc,
    plugins: editor.extensionManager.plugins,
  });

  return Arr.isReadonlyArrayNonEmpty(
    state.applyTransaction(edit(state.tr)).transactions
  );
}

describe("richOptions", () => {
  describe("the limit", () => {
    it("refuses an edit that would take the Markdown past the limit and lets one that fits pass", () => {
      const editor = openEditor("x".repeat(15), { limit: 20 });

      expect(passes(editor, (tr) => tr.insertText("y".repeat(10)))).toBe(false);
      expect(passes(editor, (tr) => tr.insertText("yyyyy"))).toBe(true);
      editor.destroy();
    });

    it("counts the characters of the Markdown, which is what the server checks", () => {
      // An ampersand is written as five characters, so it takes five of them.
      const editor = openEditor("aaaa", { limit: 10 });

      expect(passes(editor, (tr) => tr.insertText("&&"))).toBe(false);
      expect(passes(editor, (tr) => tr.insertText("&"))).toBe(true);
      editor.destroy();
    });

    it("lets an edit that makes the text shorter pass, though the text is over the limit", () => {
      const editor = openEditor("x".repeat(30), { limit: 20 });

      expect(passes(editor, (tr) => tr.delete(1, 6))).toBe(true);
      editor.destroy();
    });

    it("lets a change that touches no word pass", () => {
      const editor = openEditor("x".repeat(20), { limit: 20 });

      expect(passes(editor, (tr) => tr.setMeta("addToHistory", false))).toBe(
        true
      );
      editor.destroy();
    });

    it("tells the reader when a paste does not fit, and only then", () => {
      const onRefuse = vi.fn<() => void>();
      const editor = openEditor("x".repeat(15), { limit: 20, onRefuse });

      // An edit that is not a paste is refused without a word: the count says it.
      expect(passes(editor, (tr) => tr.insertText("y".repeat(10)))).toBe(false);
      expect(onRefuse).not.toHaveBeenCalled();
      expect(
        passes(editor, (tr) =>
          tr.insertText("y".repeat(10)).setMeta("paste", true)
        )
      ).toBe(false);
      expect(onRefuse).toHaveBeenCalledTimes(1);
      // A paste that fits is not refused.
      expect(
        passes(editor, (tr) => tr.insertText("yy").setMeta("paste", true))
      ).toBe(true);
      expect(onRefuse).toHaveBeenCalledTimes(1);
      editor.destroy();
    });
  });

  describe("the direction", () => {
    it("puts the attribute that takes the direction of the words on every kind of block", () => {
      const editor = openEditor(DOC);
      const page = new DOMParser().parseFromString(
        editor.getHTML(),
        "text/html"
      );
      // Sixteen blocks: six paragraphs, a heading, a bullet list, a numbered
      // list and a task list with an item each, a quote, a code block and a
      // divider. A browser, not this test, decides the direction from the words
      // (`words.browser.ts`).
      const blocks = Arr.fromIterable(
        page.body.querySelectorAll("p, h2, ul, ol, li, blockquote, pre, hr")
      );

      expect(Arr.map(blocks, (block) => block.getAttribute("dir"))).toEqual(
        Arr.makeBy(16, () => "auto")
      );
      editor.destroy();
    });

    it("never changes the Markdown that is stored", () => {
      const withDirection = openEditor(DOC);
      const without = new Editor({
        content: DOC,
        element: null,
        extensions: richOptions({
          limit: 100_000,
          onRefuse: vi.fn<() => void>(),
          placeholder: "",
        }).extensions,
      });
      const stored = withDirection.getMarkdown();
      // The stored Markdown opens to a document that is written the same again.
      const reopened = openEditor(stored);

      expect(without.getMarkdown()).toBe(stored);
      expect(reopened.getMarkdown()).toBe(stored);
      withDirection.destroy();
      without.destroy();
      reopened.destroy();
    });
  });

  describe("the Markdown it reads", () => {
    /** The types of the blocks of a document, from its first to its last. */
    const typesOf = (editor: Editor) =>
      Arr.map(editor.getJSON().content ?? [], (node) => node.type);

    /** The marks in a node and the nodes under it, in the order of the text. */
    const marksOf = (node: JSONContent): string[] =>
      Arr.flatMap(node.content ?? [], (child) => [
        ...Arr.map(child.marks ?? [], (mark) => mark.type),
        ...marksOf(child),
      ]);

    it("keeps a line that starts like the item of a list as the words it is", () => {
      // Tiptap's own tokenizer takes one or two letters, or a roman numeral,
      // for the number of an item: these lines opened as one list, without
      // `Dr.`, `ok.`, `mild.` and the rest of their first words.
      const lines = [
        "Dr. Budi sakit",
        "ok. saya",
        "mild. calm",
        "Jl. Merdeka 5",
        "No. 5 is mine",
        "a) first",
        "I. Roman",
        "x. y",
      ];
      const stored = Arr.join(lines, "\n\n");
      const editor = openEditor(stored);

      expect(typesOf(editor)).toEqual(Arr.map(lines, () => "paragraph"));
      expect(editor.getMarkdown()).toBe(stored);
      editor.destroy();
    });

    it("reads a numbered list with its start, its marks and the lists inside it, and writes it as it was", () => {
      const stored = Arr.join(
        [
          "3. **three** and ++under++ and ==high==",
          "4. four",
          "   1. inside",
          "   2. and ==here==",
          "   - a bullet",
          "5. five",
          "",
          "- a bullet list",
          "  1. with a numbered one",
        ],
        "\n"
      );
      const editor = openEditor(stored);
      const [numbered] = editor.getJSON().content ?? [];

      expect(typesOf(editor)).toEqual(["orderedList", "bulletList"]);
      expect(numbered?.attrs?.start).toBe(3);
      expect(marksOf(numbered ?? {})).toEqual([
        "bold",
        "underline",
        "highlight",
        "highlight",
      ]);
      expect(editor.getMarkdown()).toBe(stored);
      editor.destroy();
    });

    it("reads a list of ten items and more, and one with another list under its last item", () => {
      const stored = Arr.join(
        [
          ...Arr.makeBy(11, (index) => `${index + 1}. item ${index + 1}`),
          "    - under eleven",
        ],
        "\n"
      );
      const editor = openEditor(stored);

      expect(typesOf(editor)).toEqual(["orderedList"]);
      expect(editor.getMarkdown()).toBe(stored);
      editor.destroy();
    });

    it("writes the code in a numbered item as it was at every save", () => {
      // Tiptap's own tokenizer moved the code one space to the right each time.
      const stored = "1. one\n   ```ts\n   const a = 1\n   ```\n2. two";
      const editor = openEditor(stored);

      expect(editor.getMarkdown()).toBe(stored);
      editor.destroy();
    });

    it("reads a numbered item with a check box as its words, with their marks", () => {
      const editor = openEditor("1. [ ] **buy** milk\n2. [x] ++done++");

      expect(typesOf(editor)).toEqual(["orderedList"]);
      expect(marksOf(editor.getJSON())).toEqual(["bold", "underline"]);
      expect(editor.getMarkdown()).toBe("1. **buy** milk\n2. ++done++");
      editor.destroy();
    });

    it("reads a mark only as a pair around words", () => {
      const marked = openEditor("x ++under++ y ==high== z");
      const plain = openEditor("I use C++ and C++20, a == b == c");

      expect(marksOf(marked.getJSON())).toEqual(["underline", "highlight"]);
      expect(marksOf(plain.getJSON())).toEqual([]);
      expect(plain.getMarkdown()).toBe("I use C++ and C++20, a == b == c");
      marked.destroy();
      plain.destroy();
    });
  });
});
