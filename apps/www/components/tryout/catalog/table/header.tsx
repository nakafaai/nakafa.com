import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  ArrowUpDownIcon,
  FilterIcon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { Column } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import {
  isTryoutSetStatusFilter,
  readTryoutSetAttemptStatus,
} from "@/components/tryout/catalog/table/filter";
import type {
  TryoutSetRow,
  TryoutSetStatusFilter,
} from "@/components/tryout/catalog/table/types";
import {
  TryoutStatusIcon,
  TryoutStatusLabel,
} from "@/components/tryout/status";

const sortLabelKeys = {
  "set-column-name": {
    asc: "set-sort-name-ascending",
    desc: "set-sort-name-descending",
  },
  "set-column-questions": {
    asc: "set-sort-questions-ascending",
    desc: "set-sort-questions-descending",
  },
} as const;

const statusFilters = [
  "all",
  "not-started",
  "in-progress",
  "completed",
  "expired",
] as const satisfies readonly TryoutSetStatusFilter[];

type TryoutSetSortColumnLabel = keyof typeof sortLabelKeys;

/** Renders the localized non-interactive score column label. */
export function TryoutSetScoreHeader() {
  const tTryouts = useTranslations("Tryouts");

  return <span>{tTryouts("set-column-score")}</span>;
}

/** Resolve a compact icon for an inactive, ascending, or descending sort. */
function getSortIcon(direction: false | "asc" | "desc") {
  if (direction === "asc") {
    return ArrowUp02Icon;
  }

  if (direction === "desc") {
    return ArrowDown02Icon;
  }

  return ArrowUpDownIcon;
}

/** Renders one contextual server-sort menu for a catalog-owned column. */
export function TryoutSetSortHeader({
  column,
  direction,
  labelKey,
}: {
  column: Column<TryoutSetRow>;
  direction: false | "asc" | "desc";
  labelKey: TryoutSetSortColumnLabel;
}) {
  const tTryouts = useTranslations("Tryouts");
  const label = tTryouts(labelKey);
  const optionKeys = sortLabelKeys[labelKey];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={tTryouts("set-sort-label", { column: label })}
            className="-ml-2 max-w-full sm:-ml-3"
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
        <DropdownMenuGroup>
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
              <HugeIcons icon={ArrowUp02Icon} />
              {tTryouts(optionKeys.asc)}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc">
              <HugeIcons icon={ArrowDown02Icon} />
              {tTryouts(optionKeys.desc)}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Renders one exact workflow-status filter for the set table. */
export function TryoutSetStatusHeader({
  column,
  statusFilter,
}: {
  column: Column<TryoutSetRow>;
  statusFilter: TryoutSetStatusFilter;
}) {
  const tTryouts = useTranslations("Tryouts");
  const label = tTryouts("set-column-status");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={tTryouts("set-filter-label", { column: label })}
            className="-ml-2 max-w-full sm:-ml-3"
            size="sm"
            type="button"
            variant={statusFilter === "all" ? "ghost" : "secondary"}
          >
            {label}
            <HugeIcons data-icon="inline-end" icon={FilterIcon} />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-auto">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            onValueChange={(value) => {
              if (!isTryoutSetStatusFilter(value)) {
                return;
              }

              if (value === "all") {
                column.setFilterValue(undefined);
                return;
              }

              column.setFilterValue(value);
            }}
            value={statusFilter}
          >
            {statusFilters.map((filter) => (
              <DropdownMenuRadioItem key={filter} value={filter}>
                <TryoutStatusFilterOption filter={filter} />
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Render one status-filter option with its shared status icon and label. */
function TryoutStatusFilterOption({
  filter,
}: {
  filter: TryoutSetStatusFilter;
}) {
  const tTryouts = useTranslations("Tryouts");

  if (filter === "all") {
    return (
      <>
        <HugeIcons icon={Menu01Icon} />
        {tTryouts("set-filter-all")}
      </>
    );
  }

  const status = readTryoutSetAttemptStatus(filter);

  return (
    <>
      <TryoutStatusIcon status={status} />
      <TryoutStatusLabel status={status} />
    </>
  );
}
