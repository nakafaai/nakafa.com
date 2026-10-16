import { components } from "@repo/backend/confect/_generated/components";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { openRows } from "@repo/backend/confect/nina/sealed/open";
import {
  SealedReadError,
  type ThreadArgs,
} from "@repo/backend/confect/nina/sealed.spec";
import { Effect } from "effect";

/**
 * One read of a thread's messages, newest first: the arguments the component's
 * list takes, and the owner whose key opens what it returns.
 */
export type ThreadRead = typeof ThreadArgs.Type;

/**
 * Reads one page of a thread's messages and opens each row for `owner`. A page
 * asked for no message returns an empty page, as the Agent's list does, so no
 * query runs for it.
 */
export const readThread = Effect.fn("nina.sealed.thread")(function* (
  ctx: QueryCtx | MutationCtx,
  { owner, paginationOpts, ...filters }: ThreadRead
) {
  if (paginationOpts.numItems === 0) {
    return {
      continueCursor: paginationOpts.cursor ?? "",
      isDone: true,
      page: [],
    };
  }
  const result = yield* Effect.tryPromise({
    try: () =>
      ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
        ...filters,
        order: "desc",
        paginationOpts,
      }),
    catch: () => new SealedReadError(),
  });
  return { ...result, page: yield* openRows(owner, result.page) };
});
