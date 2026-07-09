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
  label,
}: {
  column: Column<TryoutSetRow>;
  label: string;
}) {
  const tTryouts = useTranslations("Tryouts");
  const direction = column.getIsSorted();

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
