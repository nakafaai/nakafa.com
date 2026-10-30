import { Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
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
import { Record as Rec, Schema } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import { FacetValues } from "@/components/shared/table/filter";

/** What a table page has chosen: the text of its header's search box, and the values each filtered column keeps. */
const FiltersState = Schema.Struct({
  chosen: Schema.Record(Schema.String, FacetValues),
  search: Schema.String,
});

/** The actions of the header's search box and the columns' filters. */
interface FiltersActions {
  /** Keeps the rows whose column holds one of the values, or every row when none is chosen. */
  readonly choose: (column: string, values: readonly string[]) => void;
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
    search: "",
    setSearch: (search) => set({ search }),
  }));

const FiltersContext = createContext<StoreApi<TableFilters> | null>(null);

/**
 * Gives a table page its filters, created once for the page: the header's search box and the filters in the table's
 * column heads write them, and the table in the body keeps the rows they choose.
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
