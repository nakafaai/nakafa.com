import type { ReactMarkdownComponents } from "@repo/design-system/components/markdown/react/node";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { filterWhitespaceNodes } from "@repo/design-system/lib/markdown/children";

export const reactTableComponents: ReactMarkdownComponents = {
  table: ({ children, ...props }) => (
    <Table
      containerClassName="my-4 rounded-xl border"
      data-nakafa="table"
      {...props}
    >
      {filterWhitespaceNodes(children)}
    </Table>
  ),
  tbody: ({ children, ...props }) => (
    <TableBody className="bg-muted/40" data-nakafa="table-body" {...props}>
      {filterWhitespaceNodes(children)}
    </TableBody>
  ),
  td: ({ children, ...props }) => (
    <TableCell
      className="border-r last:border-r-0"
      data-nakafa="table-cell"
      {...props}
    >
      {filterWhitespaceNodes(children)}
    </TableCell>
  ),
  th: ({ children, ...props }) => (
    <TableHead
      className="border-r font-medium last:border-r-0"
      data-nakafa="table-head"
      {...props}
    >
      {filterWhitespaceNodes(children)}
    </TableHead>
  ),
  thead: ({ children, ...props }) => (
    <TableHeader
      className="border-b bg-muted/80"
      data-nakafa="table-header"
      {...props}
    >
      {filterWhitespaceNodes(children)}
    </TableHeader>
  ),
  tr: ({ children, ...props }) => (
    <TableRow
      className="border-b last:border-b-0"
      data-nakafa="table-row"
      {...props}
    >
      {filterWhitespaceNodes(children)}
    </TableRow>
  ),
};
