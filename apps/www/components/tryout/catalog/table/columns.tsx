"use client";

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { TryoutSetTableHeader } from "@/components/tryout/catalog/table/header";
import { TryoutSetTableStatus } from "@/components/tryout/catalog/table/status";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

/** Builds localized column definitions for try-out set discovery. */
export function useTryoutSetColumns() {
  const tTryouts = useTranslations("Tryouts");
  const directLabel = tTryouts("set-section-direct");
  const nameLabel = tTryouts("set-column-name");
  const questionLabel = tTryouts("set-column-questions");
  const sectionLabel = tTryouts("set-column-sections");
  const statusLabel = tTryouts("set-column-status");

  return useMemo<ColumnDef<TryoutSetRow>[]>(
    () => [
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
          <TryoutSetTableHeader column={column} label={nameLabel} />
        ),
        size: 280,
      },
      {
        accessorKey: "readyQuestionCount",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.readyQuestionCount}
          </span>
        ),
        header: ({ column }) => (
          <TryoutSetTableHeader column={column} label={questionLabel} />
        ),
        size: 100,
      },
      {
        accessorKey: "visibleSectionCount",
        cell: ({ row }) => {
          if (row.original.visibleSectionCount === 0) {
            return <span className="text-muted-foreground">{directLabel}</span>;
          }

          return (
            <span className="tabular-nums">
              {row.original.visibleSectionCount}
            </span>
          );
        },
        header: ({ column }) => (
          <TryoutSetTableHeader column={column} label={sectionLabel} />
        ),
        size: 100,
      },
      {
        accessorKey: "attemptStatus",
        cell: ({ row }) => (
          <TryoutSetTableStatus status={row.original.attemptStatus} />
        ),
        enableSorting: false,
        header: statusLabel,
        size: 160,
      },
    ],
    [directLabel, nameLabel, questionLabel, sectionLabel, statusLabel]
  );
}
