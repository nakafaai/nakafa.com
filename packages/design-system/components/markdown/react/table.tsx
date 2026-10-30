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
import {
  tableCellVariants,
  tableFrameVariants,
  tableHeadCellVariants,
  tableRowVariants,
} from "@repo/design-system/lib/prose";

export const reactTableComponents: ReactMarkdownComponents = {
  table: ({ children, node: _node, ...props }) => (
    <Table
      containerClassName={tableFrameVariants()}
      data-nakafa="table"
      {...props}
    >
      {filterWhitespaceNodes(children)}
    </Table>
  ),
  tbody: ({ children, node: _node, ...props }) => (
    <TableBody data-nakafa="table-body" {...props}>
      {filterWhitespaceNodes(children)}
    </TableBody>
  ),
  td: ({ children, node: _node, ...props }) => (
    <TableCell
      className={tableCellVariants()}
      data-nakafa="table-cell"
      {...props}
    >
      {filterWhitespaceNodes(children)}
    </TableCell>
  ),
  th: ({ children, node: _node, ...props }) => (
    <TableHead
      className={tableHeadCellVariants()}
      data-nakafa="table-head"
      {...props}
    >
      {filterWhitespaceNodes(children)}
    </TableHead>
  ),
  thead: ({ children, node: _node, ...props }) => (
    <TableHeader className="border-b" data-nakafa="table-header" {...props}>
      {filterWhitespaceNodes(children)}
    </TableHeader>
  ),
  tr: ({ children, node: _node, ...props }) => (
    <TableRow className={tableRowVariants()} data-nakafa="table-row" {...props}>
      {filterWhitespaceNodes(children)}
    </TableRow>
  ),
};
