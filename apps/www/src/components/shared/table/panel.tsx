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
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  TableHead,
  TableHeader,
} from "@repo/design-system/components/ui/table";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr, Option, Record as Rec } from "effect";
import { type ReactElement, type ReactNode, use } from "react";
import { useTranslations } from "use-intl";
import {
  columnAlign,
  type HeadAlign,
  HeadMenuContext,
  headWidth,
} from "@/components/shared/table/align";
import { boundOf } from "@/components/shared/table/filter";
import { useTableFilters } from "@/components/shared/table/toolbar";

/** The word for each way to sort a kind of column: the head already names the column, so one word says the rest. */
const sortWords = {
  days: { asc: "sort-oldest", desc: "sort-newest" },
  number: { asc: "sort-smallest", desc: "sort-largest" },
  text: { asc: "sort-a-z", desc: "sort-z-a" },
} as const;

/** How a column's head names the way it sorts the rows, for assistive technology. */
const sortNames = {
  asc: "ascending",
  desc: "descending",
  none: "none",
} as const;

/**
 * The head row of a table, one look on every table: the muted surface, which the card's rows sit under as one piece and
 * which stays solid while they scroll beneath it.
 */
export function ColumnHeads({ children }: { children: ReactNode }) {
  return (
    <TableHeader className="bg-muted sticky top-0 z-10">{children}</TableHeader>
  );
}

/**
 * One head of a table, in its place in the line. A head holds what filters its column, so this is the one module that
 * draws a `TableHead`: a table without a filter in a head has no other way to draw one.
 */
export function ColumnHead({
  children,
  menu = "center",
  place,
  sorted,
  width,
}: {
  children?: ReactNode;
  /** Where the head's menu opens under it. */
  menu?: typeof HeadAlign.Type;
  place: VariantProps<typeof columnAlign>["align"];
  /** How the column sorts the rows, for a head that sorts them. */
  sorted?: keyof typeof sortNames | undefined;
  /** What sets the column's width, for a table whose rows may arrive after its heads. */
  width?: VariantProps<typeof headWidth>["width"];
}) {
  return (
    <TableHead
      aria-sort={sorted === undefined ? undefined : sortNames[sorted]}
      className={cn(columnAlign({ align: place }), headWidth({ width }))}
      scope="col"
    >
      <HeadMenuContext value={menu}>{children}</HeadMenuContext>
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
      <PopoverContent align={use(HeadMenuContext)} className="w-auto gap-0 p-0">
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** The two ways to sort the rows by a column, side by side, the way that sorts them now pressed. */
export function HeadSort({
  kind,
  onSort,
  sorted,
}: {
  kind: keyof typeof sortWords;
  /** Sorts the rows by the column, the highest first when `descending` is true. */
  onSort: (descending: boolean) => void;
  sorted: keyof typeof sortNames;
}) {
  const t = useTranslations("DataTable");

  return (
    <div className="grid grid-cols-2 gap-1 border-b p-2">
      <Button
        aria-pressed={sorted === "asc"}
        onClick={() => onSort(false)}
        size="sm"
        type="button"
        variant={sorted === "asc" ? "secondary" : "ghost"}
      >
        <HugeIcons icon={ArrowUp02Icon} />
        {t(sortWords[kind].asc)}
      </Button>
      <Button
        aria-pressed={sorted === "desc"}
        onClick={() => onSort(true)}
        size="sm"
        type="button"
        variant={sorted === "desc" ? "secondary" : "ghost"}
      >
        <HugeIcons icon={ArrowDown02Icon} />
        {t(sortWords[kind].desc)}
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
    <div className="w-48 p-2">
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
      className="min-w-0 flex-1"
      onValueChange={(value) => onChange(value === null ? "" : String(value))}
      value={Option.getOrNull(boundOf(text))}
    >
      <NumberFieldInput
        aria-label={label}
        className="h-full bg-transparent"
        data-slot="input-group-control"
        placeholder={placeholder}
      />
    </NumberField>
  );
}

/** The range of a column of numbers, one control with a line between its ends: it keeps the rows between them. */
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
    <div className="w-48 p-2">
      <InputGroup className="divide-input divide-x">
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
      </InputGroup>
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
