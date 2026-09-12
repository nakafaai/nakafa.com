import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  ArrowUpDownIcon,
  FilterIcon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import { setFilterValidator } from "@repo/backend/convex/tryouts/sets/spec";
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
import {
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { catalogQuery } from "@/components/tryout/catalog/table/query";
import type {
  TryoutSetSort,
  TryoutSetStatusFilter,
} from "@/components/tryout/catalog/table/types";
import {
  TryoutStatusIcon,
  TryoutStatusLabel,
} from "@/components/tryout/status";

const headings = {
  title: {
    label: "set-column-name",
    asc: "set-sort-name-ascending",
    desc: "set-sort-name-descending",
  },
  readyQuestionCount: {
    label: "set-column-questions",
    asc: "set-sort-questions-ascending",
    desc: "set-sort-questions-descending",
  },
  durationSeconds: {
    label: "set-column-duration",
    asc: "set-sort-duration-ascending",
    desc: "set-sort-duration-descending",
  },
  publishedScore: {
    label: "set-column-score",
    asc: "set-sort-score-ascending",
    desc: "set-sort-score-descending",
  },
} as const;

interface SortControls {
  onSort: (sort: TryoutSetSort) => void;
  sort: TryoutSetSort;
}

/** Fixed columns keep the same geometry while the server changes row order. */
export function TryoutTableHeader({
  filter,
  onFilter,
  ...props
}: SortControls & {
  filter: TryoutSetStatusFilter;
  onFilter: (filter: TryoutSetStatusFilter) => void;
}) {
  return (
    <TableHeader className="sticky top-0 z-10 bg-background">
      <TableRow className="hover:bg-transparent hover:text-inherit">
        <TryoutSortHeading {...props} field="title" />
        <TryoutStatusHeading filter={filter} onFilter={onFilter} />
        <TryoutSortHeading {...props} field="readyQuestionCount" />
        <TryoutSortHeading {...props} field="durationSeconds" />
        <TryoutSortHeading {...props} field="publishedScore" />
      </TableRow>
    </TableHeader>
  );
}

/** A stable menu updates only the URL sort and preserves keyboard focus. */
function TryoutSortHeading({
  field,
  onSort,
  sort,
}: SortControls & { field: keyof typeof headings }) {
  const t = useTranslations("Tryouts");
  const copy = headings[field];
  const direction = sort.field === field ? sort.direction : undefined;
  const indicator = {
    asc: { icon: ArrowUp02Icon, label: "ascending" },
    desc: { icon: ArrowDown02Icon, label: "descending" },
    none: { icon: ArrowUpDownIcon, label: "none" },
  } as const;
  const selected = indicator[direction ?? "none"];
  return (
    <TableHead
      aria-sort={selected.label}
      className={cn("px-2 sm:px-4", field !== "title" && "text-center")}
      scope="col"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("set-sort-label", { column: t(copy.label) })}
              className={cn(
                "min-w-0 max-w-[calc(100%+1rem)] overflow-hidden sm:max-w-[calc(100%+1.75rem)]",
                field === "title" ? "-ml-2 sm:-ml-3" : "-mx-2 sm:-mx-3"
              )}
              size="sm"
              variant="ghost"
            >
              <span className="min-w-0 truncate">{t(copy.label)}</span>
              <HugeIcons data-icon="inline-end" icon={selected.icon} />
            </Button>
          }
        />
        <DropdownMenuContent
          align="start"
          className="w-max max-w-[calc(100vw-1rem)]"
        >
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              onValueChange={(value) => {
                if (value === "asc" || value === "desc") {
                  onSort({ field, direction: value });
                }
              }}
              value={direction ?? ""}
            >
              <DropdownMenuRadioItem className="whitespace-normal" value="asc">
                <HugeIcons icon={ArrowUp02Icon} />
                {t(copy.asc)}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem className="whitespace-normal" value="desc">
                <HugeIcons icon={ArrowDown02Icon} />
                {t(copy.desc)}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableHead>
  );
}

/** Keeps status filtering in the existing column header. */
function TryoutStatusHeading({
  filter,
  onFilter,
}: {
  filter: TryoutSetStatusFilter;
  onFilter: (filter: TryoutSetStatusFilter) => void;
}) {
  const t = useTranslations("Tryouts");
  return (
    <TableHead className="px-2 text-center sm:px-4" scope="col">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("set-filter-label", {
                column: t("set-column-status"),
              })}
              className={cn(
                "-mx-2 min-w-0 max-w-[calc(100%+1rem)] overflow-hidden sm:-mx-3 sm:max-w-[calc(100%+1.75rem)]",
                filter !== "all" && "bg-muted text-foreground"
              )}
              size="sm"
              type="button"
              variant="ghost"
            >
              <span className="min-w-0 truncate">{t("set-column-status")}</span>
              <HugeIcons data-icon="inline-end" icon={FilterIcon} />
            </Button>
          }
        />
        <DropdownMenuContent
          align="start"
          className="w-max max-w-[calc(100vw-1rem)]"
        >
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              onValueChange={(value) => {
                const parsed = catalogQuery.status.parse(value);
                if (parsed !== null) {
                  onFilter(parsed);
                }
              }}
              value={filter}
            >
              {setFilterValidator.members.map(({ value }) => (
                <DropdownMenuRadioItem
                  className="whitespace-normal"
                  key={value}
                  value={value}
                >
                  <TryoutFilterOption filter={value} />
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableHead>
  );
}

function TryoutFilterOption({ filter }: { filter: TryoutSetStatusFilter }) {
  const t = useTranslations("Tryouts");
  if (filter === "all") {
    return (
      <>
        <HugeIcons icon={Menu01Icon} />
        {t("set-filter-all")}
      </>
    );
  }
  const status = filter === "not-started" ? null : filter;
  return (
    <>
      <TryoutStatusIcon status={status} />
      <TryoutStatusLabel status={status} />
    </>
  );
}
