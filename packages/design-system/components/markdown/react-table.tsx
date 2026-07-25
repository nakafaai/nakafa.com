import {
  type ReactMarkdownComponents,
  sameClassAndNode,
} from "@repo/design-system/components/markdown/react-node";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { filterWhitespaceNodes } from "@repo/design-system/lib/markdown/children";
import { memo } from "react";

export const reactTableComponents: ReactMarkdownComponents = {
  table: memo(
    ({ children, ...props }) => (
      <Table
        containerClassName="my-4 rounded-xl border"
        data-nakafa="table"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </Table>
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  tbody: memo(
    ({ children, ...props }) => (
      <TableBody className="bg-muted/40" data-nakafa="table-body" {...props}>
        {filterWhitespaceNodes(children)}
      </TableBody>
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  td: memo(
    ({ children, ...props }) => (
      <TableCell
        className="border-r last:border-r-0"
        data-nakafa="table-cell"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </TableCell>
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  th: memo(
    ({ children, ...props }) => (
      <TableHead
        className="border-r font-medium last:border-r-0"
        data-nakafa="table-head"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </TableHead>
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  thead: memo(
    ({ children, ...props }) => (
      <TableHeader
        className="border-b bg-muted/80"
        data-nakafa="table-header"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </TableHeader>
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
  tr: memo(
    ({ children, ...props }) => (
      <TableRow
        className="border-b last:border-b-0"
        data-nakafa="table-row"
        {...props}
      >
        {filterWhitespaceNodes(children)}
      </TableRow>
    ),
    (previous, next) => sameClassAndNode(previous, next)
  ),
};
