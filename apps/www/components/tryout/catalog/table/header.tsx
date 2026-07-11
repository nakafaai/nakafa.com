import {
  Sorting05Icon,
  SortingDownIcon,
  SortingUpIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { Column } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";

export type TryoutSetColumnLabel =
  | "set-column-name"
  | "set-column-questions"
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={tTryouts("set-sort-label", { column: label })}
            className="-ml-3"
            size="sm"
            type="button"
            variant="ghost"
          >
            {label}
            <HugeIcons data-icon="inline-end" icon={getSortIcon(direction)} />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-auto">
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (value !== "asc" && value !== "desc") {
              return;
            }

            column.toggleSorting(value === "desc", false);
          }}
          value={direction || ""}
        >
          <DropdownMenuRadioItem value="asc">
            <HugeIcons icon={SortingUpIcon} />
            {tTryouts("set-sort-ascending")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="desc">
            <HugeIcons icon={SortingDownIcon} />
            {tTryouts("set-sort-descending")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
