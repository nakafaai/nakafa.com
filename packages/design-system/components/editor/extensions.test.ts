// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { richOptions } from "@repo/design-system/components/editor/extensions";
import { Editor, type JSONContent } from "@tiptap/core";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { Array as Arr, MutableList } from "effect";

/** The editor of a memory with no page behind it, with the limit and the refusal a test names. */
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
    it("gives every block the direction of its own words", () => {
      const editor = openEditor(DOC);
      const blocks = MutableList.make<string>();

      editor.state.doc.descendants((node) => {
        if (node.isBlock) {
          MutableList.append(blocks, `${node.type.name}:${node.attrs.dir}`);
        }
      });

      expect(MutableList.toArray(blocks)).toEqual(
        Arr.map(
          [
            "paragraph",
            "heading",
            "bulletList",
            "listItem",
            "paragraph",
            "paragraph",
            "taskList",
            "taskItem",
            "paragraph",
            "blockquote",
            "paragraph",
            "codeBlock",
            "horizontalRule",
          ],
          (name) => `${name}:auto`
        )
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
});
