import {
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";

/** The header row of a settings list: one column head for each label, in order. */
export function SchoolTableHeader({ columns }: { columns: readonly string[] }) {
  return (
    <TableHeader>
      <TableRow>
        {Arr.map(columns, (column) => (
          <TableHead key={column}>{column}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}
