import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  Cancel01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { TableHead } from "@repo/design-system/components/ui/table";
import type { VariantProps } from "class-variance-authority";
import { Array as Arr, Option, Record as Rec } from "effect";
import type { ReactElement, ReactNode } from "react";
import { useTranslations } from "use-intl";
import { columnAlign } from "@/components/shared/table/align";
import { boundOf } from "@/components/shared/table/filter";
import { useTableFilters } from "@/components/shared/table/toolbar";

/** How a column's head names the way it sorts the rows, for assistive technology. */
const sortNames = {
  asc: "ascending",
  desc: "descending",
  none: "none",
} as const;

/**
 * One head of a table, in its place in the line. A head holds what filters its column, so this is the one module that
 * draws a `TableHead`: a table without a filter in a head has no other way to draw one.
 */
export function ColumnHead({
  children,
  place,
  sorted,
}: {
  children?: ReactNode;
  place: VariantProps<typeof columnAlign>["align"];
  /** How the column sorts the rows, for a head that sorts them. */
  sorted?: keyof typeof sortNames | undefined;
}) {
  return (
    <TableHead
      aria-sort={sorted === undefined ? undefined : sortNames[sorted]}
      className={columnAlign({ align: place })}
      scope="col"
    >
      {children}
    </TableHead>
  );
}

/**
 * The panel a column's head opens, under the head's button (`trigger`): the ways to sort the rows, what filters the
 * column, and Reset once it holds a choice. The table draws the button, so it stands in its place in the line.
 */
export function HeadPanel({
  children,
  trigger,
}: {
  children: ReactNode;
  trigger: ReactElement;
}) {
  return (
    <Popover>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** The two ways to sort the rows by a column, the way that sorts them now pressed. */
export function HeadSort({
  ascending,
  descending,
  onSort,
  sorted,
}: {
  ascending: string;
  descending: string;
  /** Sorts the rows by the column, the highest first when `descending` is true. */
  onSort: (descending: boolean) => void;
  sorted: keyof typeof sortNames;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b p-2">
      <Button
        aria-pressed={sorted === "asc"}
        onClick={() => onSort(false)}
        size="sm"
        type="button"
        variant={sorted === "asc" ? "secondary" : "ghost"}
      >
        <HugeIcons icon={ArrowUp02Icon} />
        {ascending}
      </Button>
      <Button
        aria-pressed={sorted === "desc"}
        onClick={() => onSort(true)}
        size="sm"
        type="button"
        variant={sorted === "desc" ? "secondary" : "ghost"}
      >
        <HugeIcons icon={ArrowDown02Icon} />
        {descending}
      </Button>
    </div>
  );
}

/** The values a column holds in the page's filters. */
function useChosen(column: string) {
  const all = useTableFilters((state) => state.chosen);
  return Option.getOrElse(Rec.get(all, column), () => []);
}

/** Whether a column holds a choice, so its head's button shows that it filters the rows. */
export function useIsFiltered(column: string) {
  return Arr.isReadonlyArrayNonEmpty(useChosen(column));
}

/** The field of a column of text: it keeps the rows whose column holds the words. */
export function HeadText({ column, label }: { column: string; label: string }) {
  const t = useTranslations("DataTable");
  const choose = useTableFilters((state) => state.choose);
  const text = Option.getOrElse(Arr.head(useChosen(column)), () => "");

  return (
    <div className="w-56 p-2">
      <InputGroup>
        <InputGroupAddon>
          <HugeIcons icon={Search01Icon} />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={label}
          onChange={(event) =>
            choose(
              column,
              event.target.value === "" ? [] : [event.target.value]
            )
          }
          placeholder={t("filter-contains")}
          value={text}
        />
      </InputGroup>
    </div>
  );
}

/** One end of a column's range of numbers, which stays blank until the reader types one. */
function RangeField({
  label,
  onChange,
  placeholder,
  text,
}: {
  label: string;
  onChange: (text: string) => void;
  placeholder: string;
  text: string;
}) {
  return (
    <NumberField
      onValueChange={(value) => onChange(value === null ? "" : String(value))}
      value={Option.getOrNull(boundOf(text))}
    >
      <NumberFieldGroup>
        <NumberFieldInput aria-label={label} placeholder={placeholder} />
      </NumberFieldGroup>
    </NumberField>
  );
}

/** The two fields of a column of numbers: it keeps the rows whose number stands between them. */
export function HeadRange({
  column,
  label,
}: {
  column: string;
  label: string;
}) {
  const t = useTranslations("DataTable");
  const choose = useTableFilters((state) => state.choose);
  const chosen = useChosen(column);
  const lowest = Option.getOrElse(Arr.get(chosen, 0), () => "");
  const highest = Option.getOrElse(Arr.get(chosen, 1), () => "");
  const keep = (from: string, to: string) =>
    choose(column, from === "" && to === "" ? [] : [from, to]);

  return (
    <div className="grid w-56 grid-cols-2 gap-2 p-2">
      <RangeField
        label={`${label}, ${t("filter-lowest")}`}
        onChange={(text) => keep(text, highest)}
        placeholder={t("filter-lowest")}
        text={lowest}
      />
      <RangeField
        label={`${label}, ${t("filter-highest")}`}
        onChange={(text) => keep(lowest, text)}
        placeholder={t("filter-highest")}
        text={highest}
      />
    </div>
  );
}

/** Reset, once the column holds a choice to drop. */
export function HeadReset({ column }: { column: string }) {
  const t = useTranslations("DataTable");
  const choose = useTableFilters((state) => state.choose);

  return useIsFiltered(column) ? (
    <div className="border-t p-2">
      <Button
        onClick={() => choose(column, [])}
        size="sm"
        type="button"
        variant="ghost"
      >
        <HugeIcons icon={Cancel01Icon} />
        {t("reset")}
      </Button>
    </div>
  ) : null;
}
