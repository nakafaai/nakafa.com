import {
  columnFilteringFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

/** Registers exactly the server-owned table features used by the try-out catalog. */
export const tryoutTableFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
});
