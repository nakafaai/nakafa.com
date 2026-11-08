import {
  type CommandProps,
  type Editor,
  Extension,
  findParentNode,
} from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import { NodeSelection, type Selection } from "@tiptap/pm/state";
import { Array as Arr, Option, Schema } from "effect";

/** The nodes a writer handles as one object: a table, a picture, and a formula of either kind. */
const ObjectType = Schema.Literals([
  "image",
  "mathBlock",
  "mathInline",
  "table",
]);

const isObjectType = Schema.is(ObjectType);

/** Whether a node is a table. */
const isTable = (node: ProseNode) => node.type.name === "table";

/** Whether a cell holds nothing: one empty text block, as a new cell holds. */
const isEmptyCell = (cell: ProseNode) =>
  cell.childCount === 1 &&
  cell.child(0).isTextblock &&
  cell.child(0).content.size === 0;

/** Whether every cell of every row of a table is empty. */
const isEmptyTable = (table: ProseNode) =>
  Arr.every(
    Arr.flatMap(table.children, (row) => row.children),
    isEmptyCell
  );

/**
 * Removes the table around the caret when none of its cells holds anything, so a table a writer
 * inserted and left empty goes with one press of Backspace or Delete. A table that holds words
 * keeps them: the press edits its cell as usual. A selection of every cell is Tiptap's own case,
 * which its table removes first.
 */
const removeEmptyTable = (editor: Editor) => {
  const { selection } = editor.state;
  if (!selection.empty) {
    return false;
  }
  return Option.match(
    Option.fromNullishOr(findParentNode(isTable)(selection)),
    {
      onNone: () => false,
      onSome: (table) =>
        isEmptyTable(table.node) && editor.commands.deleteTable(),
    }
  );
};

/**
 * The position just after the object the selection is on: the selected picture or formula, or the
 * innermost table that holds the selection. A picture selected inside a table is left first, so the
 * caret stays in its cell. None when the selection is on no object.
 */
const objectEnd = (selection: Selection) =>
  selection instanceof NodeSelection && isObjectType(selection.node.type.name)
    ? Option.some(selection.to)
    : Option.map(
        Option.fromNullishOr(findParentNode(isTable)(selection)),
        (table) => table.pos + table.node.nodeSize
      );

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    objectKeys: {
      /**
       * Moves the caret out of the object the selection is on, into the text after it, as Escape does.
       * A selection on no object is left alone, and the command fails.
       */
      leaveObject: () => ReturnType;
    };
  }
}

/**
 * Moves the caret out of the object the selection is on, so Escape leaves a table, a picture or a
 * formula and the next keystrokes write text. An inline formula leaves the caret just after it, in
 * its line. A block leaves it at the start of the text block that follows it, and when no text block
 * follows, an empty paragraph is made there for it. It reads the selection of the transaction it
 * runs in, so a chain that first selects a formula leaves that formula.
 */
const leaveObject = ({ commands, tr }: CommandProps) =>
  Option.match(objectEnd(tr.selection), {
    onNone: () => false,
    onSome: (end) => {
      const $end = tr.doc.resolve(end);
      if ($end.parent.inlineContent) {
        return commands.setTextSelection(end);
      }
      if ($end.nodeAfter?.isTextblock === true) {
        return commands.setTextSelection(end + 1);
      }
      return (
        commands.insertContentAt(end, { type: "paragraph" }) &&
        commands.setTextSelection(end + 1)
      );
    },
  });

/**
 * The keys of the objects of a document: Backspace and Delete remove a table that holds nothing,
 * and Escape leaves a table, a picture or a formula with the caret in the text after it. A selected
 * picture or formula goes with Backspace or Delete through the editor's own keys.
 */
export const objectKeys = Extension.create({
  addCommands() {
    return { leaveObject: () => leaveObject };
  },
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => removeEmptyTable(editor),
      Delete: ({ editor }) => removeEmptyTable(editor),
      Escape: ({ editor }) => editor.commands.leaveObject(),
    };
  },
  name: "objectKeys",
});
