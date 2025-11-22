"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { useQuery } from "convex/react";

type Props = {
  datasetId: Id<"datasets">;
};

export function FinanceDatasetTable({ datasetId }: Props) {
  const columns = useQuery(api.datasets.queries.getDatasetColumns, {
    datasetId,
  });
  const rows = useQuery(api.datasets.queries.getDatasetRows, {
    datasetId,
    limit: 100,
  });

  console.log("rows", rows);

  // Loading state
  if (columns === undefined || rows === undefined) {
    return (
      <div className="size-full space-y-4 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // No data state
  if (!columns || columns.length === 0) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground text-sm">No columns found</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {/* Dynamic columns */}
          {columns.map((column) => (
            <TableHead key={column._id}>{column.displayName}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows && rows.length > 0 ? (
          rows.map((row) => (
            <TableRow key={row._id}>
              {/* Dynamic data */}
              {columns.map((column) => {
                const value = row.dynamicData?.[column.name];
                return (
                  <TableCell className="max-w-xs truncate" key={column._id}>
                    {formatCellValue(value, column.dataType)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell className="text-center" colSpan={columns.length + 1}>
              <p className="text-muted-foreground text-sm">
                No data available yet. The workflow is processing...
              </p>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function formatCellValue(
  value: unknown,
  dataType: "text" | "number" | "url" | "date" | "boolean" | "json"
): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  switch (dataType) {
    case "url":
      return (
        <a
          className="text-primary underline-offset-4 hover:underline"
          href={String(value)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {String(value)}
        </a>
      );
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "boolean":
      return value ? "Yes" : "No";
    case "json":
      return (
        <pre className="max-w-xs overflow-auto text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    default:
      return String(value);
  }
}
