import type { IconSvgElement } from "@hugeicons/react";
import { getTileLooks } from "@repo/design-system/lib/look";
import { constructFilterFn } from "@tanstack/react-table";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import { matchesSearch } from "@/components/shared/table/search";

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

/** Whether a cell that holds a list, such as a member's roles, holds one of the values a facet chose. */
export function holdsChosen(value: unknown, chosen: unknown) {
  return (
    Schema.is(FacetValues)(chosen) &&
    Schema.is(FacetValues)(value) &&
    Arr.some(value, (item) => Arr.contains(chosen, item))
  );
}

/**
 * What a column of numbers keeps, as its head's two fields hold it: the lowest and the highest value, each as the
 * learner typed it, so either may stay blank.
 */
const NumberRange = Schema.Tuple([Schema.String, Schema.String]);

/** The number a field of a range holds, or none while it is blank or holds no number. */
export const boundOf = (text: string) =>
  Option.filter(
    Schema.decodeUnknownOption(Schema.FiniteFromString)(text),
    () => text.trim() !== ""
  );

/** Whether a cell's text holds every text chosen for its column: the page's search and the column's own field. */
export function holdsText(value: unknown, chosen: unknown) {
  return (
    Schema.is(FacetValues)(chosen) &&
    Schema.is(Schema.String)(value) &&
    Arr.every(chosen, (text) => matchesSearch(value, text))
  );
}

/** Whether a cell's number stands between the chosen lowest and highest value, a blank field holding no bound. */
export function inRange(value: unknown, chosen: unknown) {
  if (!(Schema.is(Schema.Finite)(value) && Schema.is(NumberRange)(chosen))) {
    return false;
  }
  const [lowest, highest] = chosen;
  return !(
    Option.exists(boundOf(lowest), (bound) => value < bound) ||
    Option.exists(boundOf(highest), (bound) => value > bound)
  );
}

/** Whether a facet chose nothing, so it filters nothing and the table drops it. */
export function choosesNothing(chosen: unknown) {
  return !(
    Schema.is(FacetValues)(chosen) && Arr.isReadonlyArrayNonEmpty(chosen)
  );
}

/**
 * The one value that a column's choice keeps, as the page's filters hold it (`ColumnChoice`): the first value chosen for
 * the column, when `is` accepts it, or none while the column keeps every row.
 */
export const chosenOne = <A extends string>(
  chosen: Readonly<Record<string, readonly string[]>>,
  column: string,
  is: (value: unknown) => value is A
) => Option.filter(Option.flatMap(Rec.get(chosen, column), Arr.head), is);

/**
 * Keeps the rows whose value is one of the values a facet chose. A faceted cell holds one
 * value, and TanStack's `arrIncludesSome` reads only cells that hold a list.
 */
export const oneOfFilter = constructFilterFn({
  autoRemove: choosesNothing,
  filter: isChosen,
});

/** Keeps the rows whose list holds one of the values a facet chose. */
export const anyOfFilter = constructFilterFn({
  autoRemove: choosesNothing,
  filter: holdsChosen,
});

/** Keeps the rows whose text holds what a text column's field and the page's search chose. */
export const textFilter = constructFilterFn({
  autoRemove: choosesNothing,
  filter: holdsText,
});

/** Keeps the rows whose number stands in the range a number column's fields chose. */
export const rangeFilter = constructFilterFn({
  autoRemove: choosesNothing,
  filter: inRange,
});

/**
 * The filters a table page holds as TanStack Table reads them: each column that chose something, the header's search
 * joining what its own column chose, so a searched column keeps its head's filter too.
 */
export function columnFiltersOf(
  chosen: Readonly<Record<string, readonly string[]>>,
  searched: string | undefined,
  search: string
) {
  const filters =
    search === "" || searched === undefined
      ? chosen
      : Rec.set(
          chosen,
          searched,
          Arr.append(
            Option.getOrElse(Rec.get(chosen, searched), () => []),
            search
          )
        );
  return Arr.map(
    Arr.filter(Rec.toEntries(filters), ([, values]) =>
      Arr.isReadonlyArrayNonEmpty(values)
    ),
    ([id, value]) => ({ id, value })
  );
}

/**
 * The options of a facet whose values the school names, such as its units or the people of its
 * trail, each with an icon of `pool` that no other value of the facet holds while the pool has one
 * free, so no two items of the column's filter draw the same icon. A facet longer than its pool repeats
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
