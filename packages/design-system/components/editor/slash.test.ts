// @vitest-environment jsdom

import { describe, expect, it } from "@effect/vitest";
import {
  filterSlash,
  runSlash,
  SLASH_KEYS,
  type SlashLabels,
} from "@repo/design-system/components/editor/slash";
import { Editor } from "@tiptap/core";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { StarterKit } from "@tiptap/starter-kit";
import { Array as Arr } from "effect";

/** The names of the blocks in English, as the editor's messages give them. */
const LABELS: SlashLabels = {
  bullets: "Bulleted list",
  "code-block": "Code block",
  "heading-1": "Heading 1",
  "heading-2": "Heading 2",
  "heading-3": "Heading 3",
  numbers: "Numbered list",
  quote: "Quote",
  table: "Table",
  text: "Normal text",
};

/** A headless editor of the blocks the menu inserts, with one paragraph of the given text. */
function openEditor(text: string) {
  return new Editor({
    content: `<p>${text}</p>`,
    element: null,
    extensions: [StarterKit, Table, TableRow, TableHeader, TableCell],
  });
}

describe("filterSlash", () => {
  it("keeps every block, in the menu's order, for an empty query", () => {
    expect(filterSlash(LABELS, "")).toEqual(SLASH_KEYS);
    expect(filterSlash(LABELS, "   ")).toEqual(SLASH_KEYS);
  });

  it("finds a block by its name, ignoring case and the spaces around the query", () => {
    expect(filterSlash(LABELS, "  HEADING ")).toEqual([
      "heading-1",
      "heading-2",
      "heading-3",
    ]);
  });

  it("finds a block by its short name as well", () => {
    expect(filterSlash(LABELS, "h2")).toEqual(["heading-2"]);
    expect(filterSlash(LABELS, "ul")).toEqual(["bullets"]);
    expect(filterSlash(LABELS, "pa")).toEqual(["text"]);
  });

  it("lists every block that shares a word, in the menu's order", () => {
    expect(filterSlash(LABELS, "list")).toEqual(["bullets", "numbers"]);
  });

  it("lists no block for a query that matches none", () => {
    expect(filterSlash(LABELS, "zzz")).toEqual([]);
  });
});

describe("runSlash", () => {
  it("makes the block of each key in place of the query that opened the menu", () => {
    const made = Arr.map(SLASH_KEYS, (key) => {
      const editor = openEditor("/");
      runSlash(key, editor, { from: 1, to: 2 });
      const block = editor.state.doc.firstChild;
      return {
        cell: block?.firstChild?.firstChild?.type.name,
        count: block?.childCount ?? 0,
        key,
        level: block?.attrs.level,
        type: block?.type.name,
      };
    });
    expect(made).toEqual([
      {
        cell: undefined,
        count: 0,
        key: "text",
        level: undefined,
        type: "paragraph",
      },
      {
        cell: undefined,
        count: 0,
        key: "heading-1",
        level: 1,
        type: "heading",
      },
      {
        cell: undefined,
        count: 0,
        key: "heading-2",
        level: 2,
        type: "heading",
      },
      {
        cell: undefined,
        count: 0,
        key: "heading-3",
        level: 3,
        type: "heading",
      },
      {
        cell: "paragraph",
        count: 1,
        key: "bullets",
        level: undefined,
        type: "bulletList",
      },
      {
        cell: "paragraph",
        count: 1,
        key: "numbers",
        level: undefined,
        type: "orderedList",
      },
      {
        cell: undefined,
        count: 1,
        key: "quote",
        level: undefined,
        type: "blockquote",
      },
      {
        cell: undefined,
        count: 0,
        key: "code-block",
        level: undefined,
        type: "codeBlock",
      },
      {
        cell: "tableHeader",
        count: 2,
        key: "table",
        level: undefined,
        type: "table",
      },
    ]);
  });

  it("removes the query text, so the slash is gone from the document", () => {
    const editor = openEditor("/");
    runSlash("quote", editor, { from: 1, to: 2 });
    expect(editor.getText()).not.toContain("/");
  });
});
