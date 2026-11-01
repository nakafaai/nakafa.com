import {
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import {
  anyOfFilter,
  oneOfFilter,
  rangeFilter,
  textFilter,
} from "@/components/shared/table/filter";

/**
 * What every Nakafa data table can do, as shadcn's data table registers it on TanStack
 * Table: filter each column, count the values a column holds, and sort.
 */
export const dataTableFeatures = tableFeatures({
  columnFacetingFeature,
  columnFilteringFeature,
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filteredRowModel: createFilteredRowModel(),
  filterFns: {
    anyOf: anyOfFilter,
    holdsText: textFilter,
    inRange: rangeFilter,
    oneOf: oneOfFilter,
  },
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});
