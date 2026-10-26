import { QueryResult } from "@confect/react";

/**
 * The answer a conversation keeps for the next render. A new answer of the
 * server replaces it. A read that is skipped, while the session changes or the
 * chat is being deleted, drops it, so the read that follows, which may be for
 * another learner, never shows the answer of the one before.
 */
export function nextAnswer<A, E>(
  answered: QueryResult.QueryResult<A, E>,
  result: QueryResult.QueryResult<A, E>
) {
  if (QueryResult.isSuccess(result)) {
    return result;
  }
  if (
    QueryResult.isLoading(result) &&
    result.skipped &&
    QueryResult.isSuccess(answered)
  ) {
    return result;
  }
  return answered;
}

/**
 * The answer a conversation shows: the server's own, which is `current`, or the
 * kept one, which is only shown, while a read of the same chat starts again and
 * while the page leaves a chat whose read failed because it was deleted.
 */
export function shownAnswer<A, E>(
  answered: QueryResult.QueryResult<A, E>,
  result: QueryResult.QueryResult<A, E>
) {
  if (QueryResult.isSuccess(result)) {
    return { current: true, value: result.value };
  }
  const reading = QueryResult.isLoading(result) && !result.skipped;
  if (
    (reading || QueryResult.isFailure(result)) &&
    QueryResult.isSuccess(answered)
  ) {
    return { current: false, value: answered.value };
  }
  return { current: false, value: undefined };
}
