"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  TryoutSetSortHeader,
  TryoutSetStatusHeader,
} from "@/components/tryout/catalog/table/header";
import type {
  TryoutSetRow,
  TryoutSetStatusFilter,
} from "@/components/tryout/catalog/table/types";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { TryoutStatusCompact } from "@/components/tryout/status";

/** Builds stable TanStack columns from the table's controlled UI state. */
export function createTryoutSetColumns({
  intent,
  sorting,
  statusFilter,
}: {
  intent: {
    setKey: string | null;
  };
  sorting: SortingState;
  statusFilter: TryoutSetStatusFilter;
}): ColumnDef<TryoutSetRow>[] {
  return [
    {
      accessorKey: "title",
      cell: ({ row }) => (
        <NavigationLink
          className="block truncate underline-offset-4 hover:underline"
          href={getTryoutPublicPathHref(row.original.publicPath)}
          prefetch={intent.setKey === row.original.setKey}
        >
          {row.original.title}
        </NavigationLink>
      ),
      enableColumnFilter: false,
      enableHiding: false,
      header: ({ column }) => (
        <TryoutSetSortHeader
          column={column}
          direction={readSortDirection(sorting, column.id)}
          labelKey="set-column-name"
        />
      ),
    },
    {
      accessorKey: "readyQuestionCount",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.readyQuestionCount}</span>
      ),
      enableColumnFilter: false,
      header: ({ column }) => (
        <TryoutSetSortHeader
          column={column}
          direction={readSortDirection(sorting, column.id)}
          labelKey="set-column-questions"
        />
      ),
    },
    {
      accessorKey: "attemptStatus",
      cell: ({ row }) => (
        <TryoutStatusCompact status={row.original.attemptStatus} />
      ),
      enableSorting: false,
      header: ({ column }) => (
        <TryoutSetStatusHeader column={column} statusFilter={statusFilter} />
      ),
    },
  ];
}

function readSortDirection(
  sorting: SortingState,
  columnId: string
): false | "asc" | "desc" {
  const active = sorting.at(0);

  if (active?.id !== columnId) {
    return false;
  }

  return active.desc ? "desc" : "asc";
}
