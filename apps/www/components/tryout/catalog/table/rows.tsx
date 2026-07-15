import { TableCell, TableRow } from "@repo/design-system/components/ui/table";
import {
  flexRender,
  type Row,
  type Table as TanStackTable,
} from "@tanstack/react-table";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";

interface TryoutTableNavigation {
  intent: (row: TryoutSetRow) => void;
  navigate: (row: TryoutSetRow) => void;
}

/** Renders data rows or the table-owned empty state. */
export function TryoutTableRows({
  emptyLabel,
  navigation,
  table,
}: {
  emptyLabel: string;
  navigation: TryoutTableNavigation;
  table: TanStackTable<TryoutSetRow>;
}) {
  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <TableRow className="hover:bg-transparent hover:text-inherit">
        <TableCell
          className="h-24 text-center text-muted-foreground"
          colSpan={table.getVisibleLeafColumns().length}
        >
          {emptyLabel}
        </TableCell>
      </TableRow>
    );
  }

  return rows.map((row) => (
    <TryoutSetTableRow key={row.id} navigation={navigation} row={row} />
  ));
}

/** Renders one fully clickable table row with navigation intent warming. */
function TryoutSetTableRow({
  navigation,
  row,
}: {
  navigation: TryoutTableNavigation;
  row: Row<TryoutSetRow>;
}) {
  return (
    <TableRow
      className="cursor-pointer"
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a")) {
          return;
        }

        navigation.navigate(row.original);
      }}
      onFocusCapture={() => navigation.intent(row.original)}
      onMouseEnter={() => navigation.intent(row.original)}
      onTouchStart={() => navigation.intent(row.original)}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell className="px-2 sm:px-4" key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}
