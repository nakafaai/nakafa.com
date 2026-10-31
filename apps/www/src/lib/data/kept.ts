import { QueryResult } from "@confect/react";
import { Option } from "effect";
import { useState } from "react";

/** The value a page shows for one query: the live value once it has one, and otherwise the last one it had. */
export const lastValue = <A, E>(
  result: QueryResult.QueryResult<A, E>,
  kept: Option.Option<A>
): Option.Option<A> =>
  QueryResult.isSuccess(result) ? Option.some(result.value) : kept;

/**
 * The last value one query answered, kept through a later failure: a page whose subject is removed elsewhere,
 * as an exam deleted in another tab, keeps its frame and its title while it says so. None until the query first
 * answers. The kept value follows each new answer, so it is never older than the last one the page drew.
 */
export function useLastValue<A, E>(
  result: QueryResult.QueryResult<A, E>
): Option.Option<A> {
  const [kept, setKept] = useState<Option.Option<A>>(Option.none);
  const shown = lastValue(result, kept);
  // A new answer replaces the kept one during the render, as React keeps a value of an earlier render.
  if (
    Option.isSome(shown) &&
    !Option.exists(kept, (value) => value === shown.value)
  ) {
    setKept(shown);
  }
  return shown;
}

/**
 * The rows a paged list shows: the rows it loaded, or, while the first page of a new scope loads, the rows it showed
 * before, so changing a filter never blanks the list. None until the list first answers.
 */
export const keptRows = <A>(
  loading: boolean,
  rows: readonly A[],
  kept: Option.Option<readonly A[]>
): Option.Option<readonly A[]> => (loading ? kept : Option.some(rows));

/**
 * The rows a paged list shows across its scopes (`keptRows`): each new answer is kept, and stands while the next
 * scope's first page loads.
 */
export function useKeptRows<A>(
  loading: boolean,
  rows: readonly A[]
): Option.Option<readonly A[]> {
  const [kept, setKept] = useState<Option.Option<readonly A[]>>(Option.none);
  const shown = keptRows(loading, rows, kept);
  if (
    Option.isSome(shown) &&
    !Option.exists(kept, (value) => value === shown.value)
  ) {
    setKept(shown);
  }
  return shown;
}
