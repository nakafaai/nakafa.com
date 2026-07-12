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
import { TryoutStatus } from "@/components/tryout/status";

/** Builds stable TanStack columns from the table's controlled UI state. */
export function createTryoutSetColumns({
  sorting,
  statusFilter,
}: {
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
      accessorKey: "publishedScore",
      cell: ({ row }) => (
        <TryoutSetScoreCell score={row.original.publishedScore} />
      ),
      enableColumnFilter: false,
      header: ({ column }) => (
        <TryoutSetSortHeader
          column={column}
          direction={readSortDirection(sorting, column.id)}
          labelKey="set-column-score"
        />
      ),
    },
    {
      accessorKey: "attemptStatus",
      cell: ({ row }) => <TryoutStatus status={row.original.attemptStatus} />,
      enableSorting: false,
      header: ({ column }) => (
        <TryoutSetStatusHeader column={column} statusFilter={statusFilter} />
      ),
    },
  ];
}

/** Renders a persisted score or an intentionally empty unscored cell. */
function TryoutSetScoreCell({ score }: { score: number | null }) {
  if (score === null) {
    return null;
  }

  return <span className="tabular-nums">{score}</span>;
}

/** Read the active direction for one controlled table column. */
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
