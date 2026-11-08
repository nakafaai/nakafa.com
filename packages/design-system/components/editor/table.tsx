import {
  DeleteColumnIcon,
  DeleteIcon,
  InsertColumnLeftIcon,
  InsertColumnRightIcon,
  InsertRowDownIcon,
  InsertRowUpIcon,
  RowDeleteIcon,
  TableIcon,
} from "@hugeicons/core-free-icons";
import {
  barLine,
  objectBar,
} from "@repo/design-system/components/editor/frame";
import { RichEditorControl } from "@repo/design-system/components/editor/tools";
import { type Editor, findParentNode } from "@tiptap/core";
import type { Selection } from "@tiptap/pm/state";
import { useCurrentEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Option } from "effect";

/** The insert control: a table of two rows and two columns, the first row a header, with the caret in its first cell. */
export function DocumentTable({ labels }: { labels: { table: string } }) {
  const { editor } = useCurrentEditor();

  return (
    <RichEditorControl
      icon={TableIcon}
      label={labels.table}
      onClick={() =>
        editor
          ?.chain()
          .focus()
          .insertTable({ cols: 2, rows: 2, withHeaderRow: true })
          .run()
      }
    />
  );
}

/** The innermost table around a selection, or none outside a table. */
const tableAround = (selection: Selection) =>
  Option.fromNullishOr(
    findParentNode((node) => node.type.name === "table")(selection)
  );

/** The box of the innermost table around the caret, which the table's bar stands beside, or none outside a table. */
const tableBox = (editor: Editor) =>
  tableAround(editor.state.selection).pipe(
    Option.flatMap((table) =>
      Option.fromNullishOr(editor.view.nodeDOM(table.pos))
    ),
    Option.filter((element) => element instanceof HTMLElement),
    Option.map((element) => ({
      getBoundingClientRect: () => element.getBoundingClientRect(),
    })),
    Option.getOrNull
  );

/** The line between two groups of the table's bar. */
function TableBarLine() {
  return <span aria-hidden="true" className={barLine({ space: true })} />;
}

/**
 * The bar of a table, at the table's top edge while the caret stands in it, so a writer adds and
 * removes rows and columns where the table is, with no menu to open: rows above and below and the
 * row's removal, then columns left and right and the column's removal, then the table's removal last.
 * It floats over the text, so it takes no room of the document, and it shows only while the editor
 * takes changes and has the focus. Each control keeps the caret in its cell, so the bar stays after a press.
 */
export function TableBar({
  labels,
}: {
  labels: {
    columnAfter: string;
    columnBefore: string;
    columnDelete: string;
    rowAfter: string;
    rowBefore: string;
    rowDelete: string;
    table: string;
    tableDelete: string;
  };
}) {
  const { editor } = useCurrentEditor();

  if (editor === null) {
    return null;
  }

  return (
    <BubbleMenu
      aria-label={labels.table}
      className={objectBar()}
      editor={editor}
      getReferencedVirtualElement={() => tableBox(editor)}
      options={{
        flip: true,
        offset: 8,
        placement: "top-start",
        shift: { padding: 8 },
      }}
      pluginKey="tableBar"
      role="toolbar"
      shouldShow={({ editor: current, state }) =>
        current.isEditable && Option.isSome(tableAround(state.selection))
      }
    >
      <RichEditorControl
        icon={InsertRowUpIcon}
        label={labels.rowBefore}
        onClick={() => editor.chain().focus().addRowBefore().run()}
      />
      <RichEditorControl
        icon={InsertRowDownIcon}
        label={labels.rowAfter}
        onClick={() => editor.chain().focus().addRowAfter().run()}
      />
      <RichEditorControl
        icon={RowDeleteIcon}
        label={labels.rowDelete}
        onClick={() => editor.chain().focus().deleteRow().run()}
      />
      <TableBarLine />
      <RichEditorControl
        icon={InsertColumnLeftIcon}
        label={labels.columnBefore}
        onClick={() => editor.chain().focus().addColumnBefore().run()}
      />
      <RichEditorControl
        icon={InsertColumnRightIcon}
        label={labels.columnAfter}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      />
      <RichEditorControl
        icon={DeleteColumnIcon}
        label={labels.columnDelete}
        onClick={() => editor.chain().focus().deleteColumn().run()}
      />
      <TableBarLine />
      <RichEditorControl
        icon={DeleteIcon}
        label={labels.tableDelete}
        onClick={() => editor.chain().focus().deleteTable().run()}
      />
    </BubbleMenu>
  );
}
