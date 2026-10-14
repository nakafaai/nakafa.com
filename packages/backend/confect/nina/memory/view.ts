import { FunctionImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import {
  type Opened,
  openMemories,
  openMemory,
} from "@repo/backend/confect/nina/memory/seal";
import {
  isCleared,
  readMemoryState,
} from "@repo/backend/confect/nina/memory/store";
import spec, {
  MEMORY_PAGE_LIMIT,
} from "@repo/backend/confect/nina/memory.spec";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
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
 * One stored memory as the Memory page shows it, opened for its learner. A
 * memory has its learner's key, and a memory without it is a defect.
 */
export const viewOf = Effect.fn("nina.memory.view.of")(function* (
  memory: Docs["ninaMemories"]
) {
  return toView(
    yield* openMemory(yield* readLearnerKeys(memory.userId), memory)
  );
}, Effect.orDie);

/**
 * One page of the Memory page: the learner's memories, the most recently
 * confirmed first, with their titles and words opened. A page holds at most
 * `MEMORY_PAGE_LIMIT` memories, however many the browser asks for. A visitor
 * gets an empty page.
 *
 * The memories that "Delete all" took (see `readMemoryState`) are the tail of
 * the list, because it is ordered by confirmation. A page that reaches them
 * stops before them and ends the list there, so the list shows none of them
 * while the batches that delete them still run. The index range stays the same
 * whether or not the learner ever asked, because the cursors of the pages a
 * browser holds belong to that range.
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
    const { clearedAt } = yield* readMemoryState(userId);
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
    const kept = Arr.takeWhile(
      result.page,
      (memory) => !isCleared(memory, clearedAt)
    );
    return {
      ...result,
      isDone: result.isDone || Arr.length(kept) < Arr.length(result.page),
      page: Arr.map(yield* openMemories(userId, kept), toView),
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
    return user
      ? { paused: (yield* readMemoryState(user.appUser._id)).paused }
      : null;
  })
);
