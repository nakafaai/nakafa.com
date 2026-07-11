"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  TryoutSetSortHeader,
  TryoutSetStatusHeader,
} from "@/components/tryout/catalog/table/header";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { TryoutStatusCompact } from "@/components/tryout/status";

/** Stable TanStack column definitions for try-out set discovery. */
export const tryoutSetColumns: ColumnDef<TryoutSetRow>[] = [
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
      <TryoutSetSortHeader column={column} labelKey="set-column-name" />
    ),
  },
  {
    accessorKey: "readyQuestionCount",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.readyQuestionCount}</span>
    ),
    enableColumnFilter: false,
    header: ({ column }) => (
      <TryoutSetSortHeader column={column} labelKey="set-column-questions" />
    ),
  },
  {
    accessorKey: "attemptStatus",
    cell: ({ row }) => (
      <TryoutStatusCompact status={row.original.attemptStatus} />
    ),
    enableSorting: false,
    header: ({ column }) => <TryoutSetStatusHeader column={column} />,
  },
];
