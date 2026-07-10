"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  TryoutSetTableHeader,
  TryoutSetTableLabel,
} from "@/components/tryout/catalog/table/header";
import { TryoutSetTableStatus } from "@/components/tryout/catalog/table/status";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

/** Stable TanStack column definitions for try-out set discovery. */
export const tryoutSetColumns: ColumnDef<TryoutSetRow>[] = [
  {
    accessorKey: "title",
    cell: ({ row }) => (
      <NavigationLink
        className="font-medium underline-offset-4 hover:underline"
        href={getTryoutPublicPathHref(row.original.publicPath)}
        prefetch={false}
      >
        {row.original.title}
      </NavigationLink>
    ),
    enableHiding: false,
    header: ({ column }) => (
      <TryoutSetTableHeader column={column} labelKey="set-column-name" />
    ),
    size: 280,
  },
  {
    accessorKey: "readyQuestionCount",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.readyQuestionCount}</span>
    ),
    header: ({ column }) => (
      <TryoutSetTableHeader column={column} labelKey="set-column-questions" />
    ),
    size: 100,
  },
  {
    accessorKey: "attemptStatus",
    cell: ({ row }) => (
      <TryoutSetTableStatus status={row.original.attemptStatus} />
    ),
    enableSorting: false,
    header: () => <TryoutSetTableLabel labelKey="set-column-status" />,
    size: 160,
  },
];
