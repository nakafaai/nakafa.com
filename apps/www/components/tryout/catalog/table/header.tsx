import {
  Sorting05Icon,
  SortingDownIcon,
  SortingUpIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { Column } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";

export type TryoutSetColumnLabel =
  | "set-column-name"
  | "set-column-questions"
  | "set-column-sections"
  | "set-column-status";

function getSortIcon(direction: false | "asc" | "desc") {
  if (direction === "asc") {
    return SortingUpIcon;
  }

  if (direction === "desc") {
    return SortingDownIcon;
  }

  return Sorting05Icon;
}

/** Renders one accessible server-sorted set table heading. */
export function TryoutSetTableHeader({
  column,
  labelKey,
}: {
  column: Column<TryoutSetRow>;
  labelKey: TryoutSetColumnLabel;
}) {
  const tTryouts = useTranslations("Tryouts");
  const direction = column.getIsSorted();
  const label = tTryouts(labelKey);

  return (
    <Button
      aria-label={tTryouts("set-sort-label", { column: label })}
      className="-ml-3"
      onClick={column.getToggleSortingHandler()}
      size="sm"
      type="button"
      variant="ghost"
    >
      {label}
      <HugeIcons data-icon="inline-end" icon={getSortIcon(direction)} />
    </Button>
  );
}

/** Renders one localized, non-sortable set table heading. */
export function TryoutSetTableLabel({
  labelKey,
}: {
  labelKey: TryoutSetColumnLabel;
}) {
  const tTryouts = useTranslations("Tryouts");

  return tTryouts(labelKey);
}
