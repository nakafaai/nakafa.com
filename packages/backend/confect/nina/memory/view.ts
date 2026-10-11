import { FunctionImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import {
  type Opened,
  openMemories,
} from "@repo/backend/confect/nina/memory/seal";
import { searchMemories } from "@repo/backend/confect/nina/memory/search";
import { readPaused } from "@repo/backend/confect/nina/memory/store";
import spec, {
  MEMORY_PAGE_LIMIT,
  MEMORY_SEARCH_LIMIT,
} from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Effect } from "effect";

/** One memory as the Memory page shows it: its title and words, never its kind. */
function toView(memory: Opened) {
  return {
    author: memory.author,
    confirmedAt: memory.confirmedAt,
    createdAt: memory._creationTime,
    id: memory._id,
    text: memory.text,
    ...(memory.title === undefined ? {} : { title: memory.title }),
    ...(memory.validUntil === undefined
      ? {}
      : { validUntil: memory.validUntil }),
  };
}

/**
 * One page of the Memory page: the learner's memories, the most recently
 * confirmed first, with their titles and words opened. A page holds at most
 * `MEMORY_PAGE_LIMIT` memories, however many the browser asks for. A visitor
 * gets an empty page.
 */
export const list = FunctionImpl.make(
  schema,
  spec,
  "list",
  Effect.fn("nina.memory.list")(function* ({ paginationOpts }) {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const userId = user.appUser._id;
    const result = yield* (yield* DatabaseReader)
      .table("ninaMemories")
      .index(
        "by_userId_and_confirmedAt",
        (query) => query.eq("userId", userId),
        "desc"
      )
      .paginate({
        ...paginationOpts,
        numItems: Math.min(paginationOpts.numItems, MEMORY_PAGE_LIMIT),
      })
      .pipe(Effect.orDie);
    return {
      ...result,
      page: Arr.map(yield* openMemories(userId, result.page), toView),
    };
  })
);

/** Whether memory is paused, for the learner. A visitor has no memory to pause. */
export const state = FunctionImpl.make(
  schema,
  spec,
  "state",
  Effect.fn("nina.memory.state")(function* () {
    const user = yield* getOptionalAppUserForRead();
    return user ? { paused: yield* readPaused(user.appUser._id) } : null;
  })
);

/**
 * The memories that match what the learner typed on the Memory page, the best
 * first, at most `MEMORY_SEARCH_LIMIT`. An empty search and a visitor get none.
 * A search finds memories while memory is paused, because the learner manages
 * them there.
 */
export const search = FunctionImpl.make(
  schema,
  spec,
  "search",
  Effect.fn("nina.memory.search")(function* ({ query }) {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return [];
    }
    return Arr.map(
      yield* searchMemories({
        limit: MEMORY_SEARCH_LIMIT,
        text: query,
        userId: user.appUser._id,
      }),
      toView
    );
  })
);
