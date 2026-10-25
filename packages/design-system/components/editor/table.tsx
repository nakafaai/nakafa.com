import {
  ArrowDown01Icon,
  ColumnInsertIcon,
  DeleteColumnIcon,
  DeleteIcon,
  RowDeleteIcon,
  RowInsertIcon,
  TableIcon,
} from "@hugeicons/core-free-icons";
import { ToolHint } from "@repo/design-system/components/editor/tip";
import { RichEditorControl } from "@repo/design-system/components/editor/tools";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useCurrentEditor, useEditorState } from "@tiptap/react";
import type { ComponentProps } from "react";

/** One action of a table, as the menu lists it. */
function TableAction({
  icon,
  label,
  onSelect,
}: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  label: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onSelect}>
      <HugeIcons icon={icon} />
      {label}
    </DropdownMenuItem>
  );
}

/**
 * The table controls. The insert control places a table of two rows and two columns, the
 * first row a header, with the caret in its first cell. While the caret sits in a table, a
 * menu beside it adds and removes rows and columns, and removes the table.
 */
export function DocumentTable({
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
    tableActions: string;
    tableDelete: string;
  };
}) {
  const { editor } = useCurrentEditor();
  const inTable = useEditorState({
    editor,
    selector: ({ editor: current }) => current?.isActive("table") ?? false,
  });

  return (
    <>
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
      {inTable ? (
        <DropdownMenu>
          <ToolHint label={labels.tableActions}>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={labels.tableActions}
                  className="gap-0.5 has-[>svg]:px-1.5"
                  size="sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeIcons icon={TableIcon} />
              <HugeIcons
                className="size-3 text-muted-foreground"
                icon={ArrowDown01Icon}
              />
            </DropdownMenuTrigger>
          </ToolHint>
          <DropdownMenuContent className="w-48">
            <TableAction
              icon={RowInsertIcon}
              label={labels.rowBefore}
              onSelect={() => editor?.chain().focus().addRowBefore().run()}
            />
            <TableAction
              icon={RowInsertIcon}
              label={labels.rowAfter}
              onSelect={() => editor?.chain().focus().addRowAfter().run()}
            />
            <TableAction
              icon={RowDeleteIcon}
              label={labels.rowDelete}
              onSelect={() => editor?.chain().focus().deleteRow().run()}
            />
            <TableAction
              icon={ColumnInsertIcon}
              label={labels.columnBefore}
              onSelect={() => editor?.chain().focus().addColumnBefore().run()}
            />
            <TableAction
              icon={ColumnInsertIcon}
              label={labels.columnAfter}
              onSelect={() => editor?.chain().focus().addColumnAfter().run()}
            />
            <TableAction
              icon={DeleteColumnIcon}
              label={labels.columnDelete}
              onSelect={() => editor?.chain().focus().deleteColumn().run()}
            />
            <TableAction
              icon={DeleteIcon}
              label={labels.tableDelete}
              onSelect={() => editor?.chain().focus().deleteTable().run()}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );
}
