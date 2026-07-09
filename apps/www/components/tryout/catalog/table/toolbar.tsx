"use client";

import { ColumnsThreeCogIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { Column, Table } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";

function TryoutSetColumnToggle({ column }: { column: Column<TryoutSetRow> }) {
  const tTryouts = useTranslations("Tryouts");
  let label = tTryouts("set-column-status");

  if (column.id === "readyQuestionCount") {
    label = tTryouts("set-column-questions");
  }

  if (column.id === "visibleSectionCount") {
    label = tTryouts("set-column-sections");
  }

  return (
    <DropdownMenuCheckboxItem
      checked={column.getIsVisible()}
      onCheckedChange={(checked) => column.toggleVisibility(checked)}
    >
      {label}
    </DropdownMenuCheckboxItem>
  );
}

/** Renders the compact column visibility controls for the set table. */
export function TryoutSetTableToolbar({
  table,
}: {
  table: Table<TryoutSetRow>;
}) {
  const tTryouts = useTranslations("Tryouts");
  const columns = table.getAllColumns().filter((column) => column.getCanHide());

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button size="sm" type="button" variant="outline" />}
        >
          <HugeIcons data-icon="inline-start" icon={ColumnsThreeCogIcon} />
          {tTryouts("set-columns-label")}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {tTryouts("set-columns-menu-label")}
            </DropdownMenuLabel>
            {columns.map((column) => (
              <TryoutSetColumnToggle column={column} key={column.id} />
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
