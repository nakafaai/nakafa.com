import { constructFilterFn } from "@tanstack/react-table";
import { Array as Arr, Schema } from "effect";

/** What a facet's menu holds: the values of its column that it keeps. */
export const FacetValues = Schema.Array(Schema.String);

/** Whether a cell's value is one of the values a facet chose. */
export function isChosen(value: unknown, chosen: unknown) {
  return (
    Schema.is(FacetValues)(chosen) &&
    Schema.is(Schema.String)(value) &&
    Arr.contains(chosen, value)
  );
}

/** Whether a facet chose nothing, so it filters nothing and the table drops it. */
export function choosesNothing(chosen: unknown) {
  return !(
    Schema.is(FacetValues)(chosen) && Arr.isReadonlyArrayNonEmpty(chosen)
  );
}

/**
 * Keeps the rows whose value is one of the values a facet chose. A faceted cell holds one
 * value, and TanStack's `arrIncludesSome` reads only cells that hold a list.
 */
export const oneOfFilter = constructFilterFn({
  autoRemove: choosesNothing,
  filter: isChosen,
});
