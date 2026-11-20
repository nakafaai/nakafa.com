import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  Cancel01Icon,
  FilterIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import { use } from "react";
import { useTranslations } from "use-intl";
import { HeadMenuContext } from "@/components/shared/table/align";
import type {
  ColumnOption,
  ColumnSortWords,
} from "@/components/shared/table/columns";
import { TableHeadButton } from "@/components/shared/table/head";
import { RemoteChoiceContext } from "@/components/shared/table/remote";
import { useTableFilters } from "@/components/shared/table/toolbar";

/** The arrow of a column's head while its server sorts the rows each way, and the filter's icon while it does not. */
const SORT_ICONS = {
  asc: ArrowUp02Icon,
  desc: ArrowDown02Icon,
  none: FilterIcon,
};

/**
 * The head of a column that filters by the values it holds, as the try-out catalog filters its status: the column's
 * name with the filter's icon, which stands out while a value is chosen, and a menu of the values, each with its icon,
 * and Reset once one is chosen. A column that holds no value yet says so in the same menu, so its head stands as every
 * other head does and fills in once a row holds a value. Choosing values keeps the rows whose column holds any of them,
 * so a table page keeps its filters in the columns they filter and never in its header.
 */
export function ColumnFilter({
  column,
  options,
  title,
}: {
  /** The ID of the column whose values the filter keeps. */
  column: string;
  options: readonly ColumnOption[];
  title: string;
}) {
  const t = useTranslations("DataTable");
  const common = useTranslations("Common");
  // The store's own record is the selection, so the snapshot stays the same object between renders; a list made in
  // the selector would be new on every read, and React would render the head without end.
  const all = useTableFilters((state) => state.chosen);
  const chosen = Option.getOrElse(Rec.get(all, column), () => []);
  const choose = useTableFilters((state) => state.choose);
  const filtered = Arr.isReadonlyArrayNonEmpty(chosen);
  const align = use(HeadMenuContext);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <TableHeadButton
            active={filtered}
            aria-label={t("filter-by", { column: title })}
            icon={FilterIcon}
          >
            {title}
          </TableHeadButton>
        }
      />
      <DropdownMenuContent
        align={align}
        className="min-w-48"
        label={common("menu-filter")}
      >
        <DropdownMenuGroup>
          {Arr.isReadonlyArrayEmpty(options) ? (
            <DropdownMenuItem disabled icon={InformationCircleIcon}>
              {t("no-values")}
            </DropdownMenuItem>
          ) : null}
          {Arr.map(options, (option) => (
            <DropdownMenuCheckboxItem
              checked={Arr.contains(chosen, option.value)}
              icon={option.icon}
              key={option.value}
              onCheckedChange={(next) =>
                choose(
                  column,
                  next
                    ? Arr.append(chosen, option.value)
                    : Arr.filter(chosen, (value) => value !== option.value)
                )
              }
              value={option.value}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {filtered ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                icon={Cancel01Icon}
                onSelect={() => choose(column, [])}
              >
                {t("reset")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The head of a column whose list the server filters by one value: the column's name with the filter's icon, which
 * stands out while a value other than the first is chosen, and a menu of the values, the first of which keeps every
 * row. The choice lives in the page's filters under the column's ID, where the list reads it (`chosenOne`), so the
 * first value chooses nothing. A column the server also sorts by (`sort`) offers both ways under its values, the one
 * that sorts the rows now marked, and its head shows that way's arrow.
 */
export function ColumnChoice({
  column,
  options,
  sort,
  title,
}: {
  /** The ID of the column whose value the server filters by. */
  column: string;
  /** The values in order, the one that keeps every row first. */
  options: readonly ColumnOption[];
  /** How the server sorts the rows by the column, for a column it sorts by. */
  sort?:
    | {
        /** Sorts the rows by the column, the last value first when `descending` is true. */
        readonly onSort: (descending: boolean) => void;
        readonly sorted: "asc" | "desc" | "none";
        readonly words: ColumnSortWords;
      }
    | undefined;
  title: string;
}) {
  const t = useTranslations("DataTable");
  const common = useTranslations("Common");
  const server = use(RemoteChoiceContext);
  const all = useTableFilters((state) => state.chosen);
  const choose = useTableFilters((state) => state.choose);
  const align = use(HeadMenuContext);
  const first = Option.map(Arr.head(options), (option) => option.value);
  // The value other than the first, which keeps every row: the address's for a list it filters, else the page's.
  const picked = Option.filter(
    server === undefined
      ? Option.flatMap(Rec.get(all, column), Arr.head)
      : Rec.get(server.chosen, column),
    (chosen) => !Option.contains(first, chosen)
  );
  const value = Option.getOrElse(
    Option.orElse(picked, () => first),
    () => ""
  );
  const sorts = sort !== undefined && sort.sorted !== "none";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <TableHeadButton
            active={Option.isSome(picked) || sorts}
            aria-label={t("filter-by", { column: title })}
            icon={SORT_ICONS[sort?.sorted ?? "none"]}
          >
            {title}
          </TableHeadButton>
        }
      />
      <DropdownMenuContent
        align={align}
        className="min-w-48"
        label={common("menu-filter")}
      >
        <DropdownMenuRadioGroup
          onValueChange={(next) => {
            if (!Schema.is(Schema.String)(next)) {
              return;
            }
            if (server !== undefined) {
              server.choose(column, next);
              return;
            }
            choose(column, Option.contains(first, next) ? [] : [next]);
          }}
          value={value}
        >
          {Arr.map(options, (option) => (
            <DropdownMenuRadioItem
              icon={option.icon}
              key={option.value}
              value={option.value}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {sort === undefined ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              onValueChange={(next) => sort.onSort(next === "desc")}
              value={sort.sorted}
            >
              <DropdownMenuRadioItem icon={ArrowUp02Icon} value="asc">
                {sort.words.asc}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem icon={ArrowDown02Icon} value="desc">
                {sort.words.desc}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
