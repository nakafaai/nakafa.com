import type { IconSvgElement } from "@hugeicons/react";
import { getTileLooks } from "@repo/design-system/lib/look";
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

/**
 * The options of a facet whose values the school names, such as its units or the people of its
 * trail, each with an icon of `pool` that no other value of the facet holds while the pool has one
 * free, so no two items of the Filter menu draw the same icon. A facet longer than its pool repeats
 * the icon it holds least first.
 */
export function namedOptions(
  values: readonly string[],
  pool: Arr.NonEmptyReadonlyArray<IconSvgElement>
) {
  return Arr.zipWith(
    values,
    getTileLooks(Arr.map(values, (value) => [pool, value] as const)),
    (value, look) => ({ icon: look.icon, label: value, value })
  );
}
