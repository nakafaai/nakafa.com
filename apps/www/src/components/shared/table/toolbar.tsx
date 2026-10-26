import {
  Cancel01Icon,
  FilterHorizontalIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import {
  type ComponentProps,
  createContext,
  Fragment,
  type ReactNode,
  use,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import { createStore, type StoreApi, useStore } from "zustand";
import { FacetValues } from "@/components/shared/table/filter";

/** What a table page's header has chosen: the text of its search box, and the values each filtered column keeps. */
const FiltersState = Schema.Struct({
  chosen: Schema.Record(Schema.String, FacetValues),
  search: Schema.String,
});

/** The actions of the header's search box and Filter menu. */
interface FiltersActions {
  /** Keeps the rows whose column holds one of the values, or every row when none is chosen. */
  readonly choose: (column: string, values: readonly string[]) => void;
  /** Chooses no value in any column again. */
  readonly reset: () => void;
  /** Keeps the rows whose searched column holds the text. */
  readonly setSearch: (search: string) => void;
}

/** The filters of one table page, with their actions. */
type TableFilters = typeof FiltersState.Type & FiltersActions;

/** Creates the filters of one table page, with nothing chosen. */
const createTableFilters = () =>
  createStore<TableFilters>()((set) => ({
    choose: (column, values) =>
      set((state) => ({ chosen: Rec.set(state.chosen, column, values) })),
    chosen: {},
    reset: () => set({ chosen: {} }),
    search: "",
    setSearch: (search) => set({ search }),
  }));

const FiltersContext = createContext<StoreApi<TableFilters> | null>(null);

/**
 * Gives a table page its filters, created once for the page: the header's search box and Filter menu write them, and
 * the table in the body keeps the rows they choose.
 */
export function TableFiltersProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createTableFilters);

  return <FiltersContext value={store}>{children}</FiltersContext>;
}

/** Reads one selected slice of the page's filters. */
export function useTableFilters<T>(selector: (state: TableFilters) => T) {
  const store = use(FiltersContext);

  if (store === null) {
    throw new Error("useTableFilters must be used within TableFiltersProvider");
  }

  return useStore(store, selector);
}

/**
 * The search box of a table page, in its header row. A wide header shows the box itself; a narrow one shows its
 * button, which opens the box under it, so the page's name and its main action keep their room.
 */
export function TableSearch({ placeholder }: { placeholder: string }) {
  const search = useTableFilters((state) => state.search);
  const setSearch = useTableFilters((state) => state.setSearch);

  return (
    <>
      <InputGroup className="hidden w-56 lg:flex xl:w-64">
        <InputGroupAddon>
          <HugeIcons icon={Search01Icon} />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={placeholder}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={placeholder}
          value={search}
        />
      </InputGroup>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              aria-label={placeholder}
              className="lg:hidden"
              size="icon"
              type="button"
              variant={search === "" ? "outline" : "secondary"}
            >
              <HugeIcons icon={Search01Icon} />
            </Button>
          }
        />
        <PopoverContent align="end" className="w-72 p-2">
          <InputGroup>
            <InputGroupAddon>
              <HugeIcons icon={Search01Icon} />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={placeholder}
              autoFocus
              onChange={(event) => setSearch(event.target.value)}
              placeholder={placeholder}
              value={search}
            />
          </InputGroup>
        </PopoverContent>
      </Popover>
    </>
  );
}

/** The icon data that the design system's icon takes. */
type FacetIcon = ComponentProps<typeof HugeIcons>["icon"];

/** A column that filters by the values it holds: its title, the icon of its values, and the label of each value. */
interface TableFacet {
  readonly column: string;
  /** The icon of each value, unless the value names its own. */
  readonly icon: FacetIcon;
  readonly options: readonly {
    readonly icon?: FacetIcon;
    readonly label: string;
    readonly value: string;
  }[];
  readonly title: string;
}

/**
 * The one Filter menu of a table page, in its header row: a group for each column that filters by its values, each
 * value with its icon, and Reset once a value is chosen. Choosing values keeps the rows that hold any of them. A
 * narrow header shows the button's icon alone.
 */
export function TableFilter({ facets }: { facets: readonly TableFacet[] }) {
  const t = useTranslations("DataTable");
  const chosen = useTableFilters((state) => state.chosen);
  const choose = useTableFilters((state) => state.choose);
  const reset = useTableFilters((state) => state.reset);
  const chosenOf = (column: string) =>
    Option.getOrElse(Rec.get(chosen, column), () => []);
  const filtered = Arr.some(facets, (facet) =>
    Arr.isReadonlyArrayNonEmpty(chosenOf(facet.column))
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("filter")}
            type="button"
            variant={filtered ? "secondary" : "outline"}
          >
            <HugeIcons icon={FilterHorizontalIcon} />
            <span className="hidden lg:inline">{t("filter")}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        {Arr.map(facets, (facet, index) => (
          <Fragment key={facet.column}>
            {index === 0 ? null : <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel>{facet.title}</DropdownMenuLabel>
              {Arr.map(facet.options, (option) => {
                const values = chosenOf(facet.column);
                return (
                  <DropdownMenuCheckboxItem
                    checked={Arr.contains(values, option.value)}
                    closeOnClick={false}
                    key={option.value}
                    onCheckedChange={(next) =>
                      choose(
                        facet.column,
                        next
                          ? Arr.append(values, option.value)
                          : Arr.filter(
                              values,
                              (value) => value !== option.value
                            )
                      )
                    }
                  >
                    <HugeIcons icon={option.icon ?? facet.icon} />
                    <span className="truncate">{option.label}</span>
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
        {filtered ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={reset}>
              <HugeIcons icon={Cancel01Icon} />
              {t("reset")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The Filter menu of a table page whose list keeps the rows of one chosen value, as a list the server filters, in
 * its header row: one group of values, each with its icon, and the first value keeps every row. The button stands
 * out while another value is chosen. A narrow header shows the button's icon alone.
 */
export function TableChoice<Value extends string>({
  onChange,
  options,
  title,
  value,
}: {
  onChange: (value: Value) => void;
  /** The values in order, the one that keeps every row first. */
  options: readonly {
    readonly icon: FacetIcon;
    readonly label: string;
    readonly value: Value;
  }[];
  title: string;
  value: Value;
}) {
  const t = useTranslations("DataTable");
  const filtered = Option.match(Arr.head(options), {
    onNone: () => false,
    onSome: (first) => first.value !== value,
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("filter")}
            type="button"
            variant={filtered ? "secondary" : "outline"}
          >
            <HugeIcons icon={FilterHorizontalIcon} />
            <span className="hidden lg:inline">{t("filter")}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{title}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={(next) =>
              Option.map(
                Arr.findFirst(options, (option) => option.value === next),
                (option) => onChange(option.value)
              )
            }
            value={value}
          >
            {Arr.map(options, (option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <HugeIcons icon={option.icon} />
                <span className="truncate">{option.label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
