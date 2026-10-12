import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { syncKeys } from "@repo/backend/confect/nina/memory/keys";
import spec from "@repo/backend/confect/nina/memory/rekey.spec";
import { openWith } from "@repo/backend/confect/nina/memory/seal";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import { Array as Arr, Effect, Layer } from "effect";

/**
 * Memories one page looks at. A memory has at most 104 key rows, so a page
 * reads and writes a few thousand documents, far below what one transaction may.
 */
const REKEY_PAGE = 25;

/**
 * Gives one memory the keys of the current version of the index, from its own
 * words, its title and its topics, and returns how many key rows that wrote.
 * The sync deletes the word keys of an older version, which the memory should
 * not have, and inserts the keys it lacks. A memory whose keys are already
 * current writes nothing.
 */
const rekeyMemory = Effect.fn("nina.memory.rekey.memory")(function* (
  memory: Docs["ninaMemories"]
) {
  const keys = yield* readLearnerKeys(memory.userId);
  const [opened] = yield* openWith(keys, [memory]);
  return yield* syncKeys(keys, memory._id, {
    confirmedAt: memory.confirmedAt,
    text: opened.text,
    title: opened.title,
    topics: memory.topics,
  });
}, Effect.orDie);

/**
 * Looks at one page of memories, oldest first, and gives each the keys of the
 * current version of the index. It returns how many it looked at, how many of
 * those it changed, and the cursor of the next page; `done` is true on the last
 * page. It reads and writes one page and never schedules itself.
 *
 * Temporary migration (ADR 0022). Version 2 of the word index changed what a
 * word is, so a memory written before it holds word keys that no search finds.
 * A memory is re-keyed by its next write (the learner's edit, or a capture that
 * names it), and this function re-keys the others. Deploy first, and then run
 * it at once on that deployment: until it is `done`, a memory that holds only
 * version 1 keys is found through its topics and not through its words, and a
 * capture that restates it, because the model never saw it, adds a copy. The
 * operator runs it with the Convex CLI against dev and then production, one
 * call after another with the cursor of the call before, until `done` is true,
 * and once more to see `rekeyed` at 0 over the whole table. Cleanup: when dev
 * and production both show that, delete this file, `rekey.spec.ts`,
 * `rekey.impl.test.ts` and their generated functions. The version in
 * `memory/keys` stays: it is part of every key.
 */
const page = FunctionImpl.make(
  schema,
  spec,
  "page",
  Effect.fn("nina.memory.rekey.page")(function* ({ cursor }) {
    const memories = yield* (yield* DatabaseReader)
      .table("ninaMemories")
      .index("by_creation_time")
      .paginate({ cursor: cursor ?? null, numItems: REKEY_PAGE })
      .pipe(Effect.orDie);
    const written = yield* Effect.forEach(memories.page, rekeyMemory);
    return {
      checked: Arr.length(memories.page),
      cursor: memories.continueCursor,
      done: memories.isDone,
      rekeyed: Arr.length(Arr.filter(written, (rows) => rows > 0)),
    };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(page),
  GroupImpl.finalize
);
