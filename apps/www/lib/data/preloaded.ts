import type * as Ref from "@confect/core/Ref";
import { QueryResult, useQuery } from "@confect/react";

/**
 * Chooses what a page shows for one query, as a query result. The live result
 * wins once Confect has one. Until then the loader's value stands in as a
 * success, so the first HTML and the first paint carry the data. A page with no
 * loader value keeps the live result, which a page without a first read needs.
 */
export function readPreloadedResult<A, E>(
  live: QueryResult.QueryResult<A, E>,
  preloaded: A | undefined
): QueryResult.QueryResult<A, E> {
  if (preloaded === undefined || !QueryResult.isLoading(live)) {
    return live;
  }
  return QueryResult.succeed(preloaded);
}

/**
 * The one hook of a Confect query whose first value is the loader's. Confect
 * React owns the subscription, and this hook only chooses the value. The loader
 * reads the first value on the server, so the page's branches on the query
 * result stay as they are.
 */
export function usePreloadedQueryResult<Query extends Ref.AnyPublicQuery>(
  ref: Query,
  args: Ref.Args<Query> | "skip",
  preloaded: Ref.Returns<Query> | undefined
): QueryResult.QueryResult<Ref.Returns<Query>, Ref.Error<Query>> {
  const live = useQuery(ref, args);
  return readPreloadedResult(live, preloaded);
}
