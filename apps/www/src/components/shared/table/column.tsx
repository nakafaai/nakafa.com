import { Cancel01Icon, FilterIcon } from "@hugeicons/core-free-icons";
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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";
import { TableHeadButton } from "@/components/shared/table/head";
import { useTableFilters } from "@/components/shared/table/toolbar";

/**
 * One value a column filters by: its label, and its icon, which fits the value and which no other value of the column
 * draws. A value holds a function's data (the icon), so it is a plain shape.
 */
interface ColumnOption {
  readonly icon: ComponentProps<typeof HugeIcons>["icon"];
  readonly label: string;
  readonly value: string;
}

/**
 * The head of a column that filters by the values it holds, as the try-out catalog filters its status: the column's
 * name with the filter's icon, which stands out while a value is chosen, and a menu of the values, each with its icon,
 * and Reset once one is chosen. Choosing values keeps the rows whose column holds any of them, so a table page keeps
 * its filters in the columns they filter and never in its header.
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
  // The store's own record is the selection, so the snapshot stays the same object between renders; a list made in
  // the selector would be new on every read, and React would render the head without end.
  const all = useTableFilters((state) => state.chosen);
  const chosen = Option.getOrElse(Rec.get(all, column), () => []);
  const choose = useTableFilters((state) => state.choose);
  const filtered = Arr.isReadonlyArrayNonEmpty(chosen);

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
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuGroup>
          {Arr.map(options, (option) => (
            <DropdownMenuCheckboxItem
              checked={Arr.contains(chosen, option.value)}
              closeOnClick={false}
              key={option.value}
              onCheckedChange={(next) =>
                choose(
                  column,
                  next
                    ? Arr.append(chosen, option.value)
                    : Arr.filter(chosen, (value) => value !== option.value)
                )
              }
            >
              <HugeIcons icon={option.icon} />
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {filtered ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => choose(column, [])}>
                <HugeIcons icon={Cancel01Icon} />
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
 * first value chooses nothing.
 */
export function ColumnChoice({
  column,
  options,
  title,
}: {
  /** The ID of the column whose value the server filters by. */
  column: string;
  /** The values in order, the one that keeps every row first. */
  options: readonly ColumnOption[];
  title: string;
}) {
  const t = useTranslations("DataTable");
  const all = useTableFilters((state) => state.chosen);
  const chosen = Option.getOrElse(Rec.get(all, column), () => []);
  const choose = useTableFilters((state) => state.choose);
  const first = Option.map(Arr.head(options), (option) => option.value);
  const value = Option.getOrElse(
    Option.orElse(Arr.head(chosen), () => first),
    () => ""
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <TableHeadButton
            active={Arr.isReadonlyArrayNonEmpty(chosen)}
            aria-label={t("filter-by", { column: title })}
            icon={FilterIcon}
          >
            {title}
          </TableHeadButton>
        }
      />
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            onValueChange={(next) =>
              choose(
                column,
                Option.contains(first, next) || !Schema.is(Schema.String)(next)
                  ? []
                  : [next]
              )
            }
            value={value}
          >
            {Arr.map(options, (option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <HugeIcons icon={option.icon} />
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
