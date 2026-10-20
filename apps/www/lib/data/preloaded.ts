import type * as Ref from "@confect/core/Ref";
import { QueryResult, useQuery } from "@confect/react";
import { Result } from "effect";

/**
 * Chooses what a page shows for one query. The live value wins once Confect has
 * one. Until then the loader's value stands in, so the first HTML and the first
 * paint carry the data. A failed live query is the failure, and the error
 * boundary shows it.
 */
export function readPreloaded<A, E>(
  live: QueryResult.QueryResult<A, E>,
  preloaded: A
): Result.Result<A, E> {
  if (QueryResult.isSuccess(live)) {
    return Result.succeed(live.value);
  }
  if (QueryResult.isFailure(live)) {
    return Result.fail(live.error);
  }
  return Result.succeed(preloaded);
}

/**
 * A Confect query whose first value is the loader's. Confect React owns the
 * subscription, and this hook only chooses the value. The loader is the one
 * place that reads the first value on the server.
 */
export function usePreloadedQuery<Query extends Ref.AnyPublicQuery>(
  ref: Query,
  args: Ref.Args<Query>,
  preloaded: Ref.Returns<Query>
): Ref.Returns<Query> {
  const live = useQuery(ref, args);
  return Result.getOrThrowWith(
    readPreloaded(live, preloaded),
    (error) => error
  );
}

/**
 * Chooses what a page shows for one query as a query result, so a page that
 * branches on the result keeps its branches. The loader's value is a success until
 * the live result arrives. A page with no loader value keeps the live result, which
 * is loading until Confect has one.
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
 * A Confect query whose first value is the loader's, returned as a query result.
 * It is the hook of a page that reads its query result, such as the school home,
 * and its branches stay as they are.
 */
export function usePreloadedQueryResult<Query extends Ref.AnyPublicQuery>(
  ref: Query,
  args: Ref.Args<Query> | "skip",
  preloaded: Ref.Returns<Query> | undefined
): QueryResult.QueryResult<Ref.Returns<Query>, Ref.Error<Query>> {
  const live = useQuery(ref, args);
  return readPreloadedResult(live, preloaded);
}
