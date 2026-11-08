import type { Ref } from "@confect/core";
import type { OptimisticLocalStore as LocalStore } from "@confect/react";
import { Array as Arr, Option } from "effect";

/**
 * Rewrites, inside an optimistic update, every loaded result of `query` with what `change` makes of it. `change` is a
 * pure transform of one result and the arguments it was loaded with, and answers none for a result it leaves as it
 * is. A result still loading keeps what it holds, so an update writes only the results it changes.
 */
export function changeLoaded<Query extends Ref.AnyPublicQuery>(
  localStore: LocalStore.OptimisticLocalStore,
  query: Query,
  change: (
    value: Ref.Returns<Query>,
    args: Ref.Args<Query>
  ) => Option.Option<Ref.Returns<Query>>
) {
  for (const loaded of localStore.getAllQueries(query)) {
    if (Option.isSome(loaded.value)) {
      const changed = change(loaded.value.value, loaded.args);
      if (Option.isSome(changed)) {
        localStore.setQuery(query, loaded.args, changed);
      }
    }
  }
}

/**
 * The first answer `pick` gives among the loaded results of `query`, in the store's order, or none when no loaded
 * result answers, as an update reads a name or a row that another loaded list already holds.
 */
export const findLoaded = <Query extends Ref.AnyPublicQuery, Found>(
  localStore: LocalStore.OptimisticLocalStore,
  query: Query,
  pick: (
    value: Ref.Returns<Query>,
    args: Ref.Args<Query>
  ) => Option.Option<Found>
): Option.Option<Found> =>
  Arr.findFirst(localStore.getAllQueries(query), (loaded) =>
    Option.flatMap(loaded.value, (value) => pick(value, loaded.args))
  );

/** A loaded page of a list with `change` made of its rows, as a list's optimistic update writes it. */
export const withPage = <
  Item,
  Value extends { readonly page: readonly Item[] },
>(
  value: Value,
  change: (page: Value["page"]) => Item[]
): Value => ({ ...value, page: change(value.page) });

/** A loaded page with `change` made of each row that `isRow` picks, or none when the page holds no such row. */
export const changeRows = <
  Item,
  Value extends { readonly page: readonly Item[] },
>(
  value: Value & { readonly page: readonly Item[] },
  isRow: (row: Item) => boolean,
  change: (row: Item) => Item
): Option.Option<Value> =>
  Arr.some(value.page, isRow)
    ? Option.some(
        withPage(value, (page) =>
          Arr.map(page, (row) => (isRow(row) ? change(row) : row))
        )
      )
    : Option.none();

/** A loaded page without the rows that `isRow` picks, or none when the page holds no such row. */
export const dropRows = <
  Item,
  Value extends { readonly page: readonly Item[] },
>(
  value: Value & { readonly page: readonly Item[] },
  isRow: (row: Item) => boolean
): Option.Option<Value> =>
  Arr.some(value.page, isRow)
    ? Option.some(
        withPage(value, (page) => Arr.filter(page, (row) => !isRow(row)))
      )
    : Option.none();
