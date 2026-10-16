import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type { NinaUpkeepCall } from "@repo/backend/confect/nina/contract/usage";
import { isUnchanged } from "@repo/backend/confect/nina/memory/seen";
import {
  readKeptMemory,
  readMemoryState,
  readNewest,
} from "@repo/backend/confect/nina/memory/store";
import type { NinaMemorySeen } from "@repo/backend/confect/nina/memory.spec";
import {
  PORTRAIT_DELAY,
  PORTRAIT_FIELD,
  readPortraitRow,
} from "@repo/backend/confect/nina/portrait/store";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect } from "effect";

type Seen = typeof NinaMemorySeen.Type;
type Call = typeof NinaUpkeepCall.Type;
type Portrait = Docs["ninaMemoryPortraits"];

/**
 * Whether every memory a build fed to the model is as the build read it: not
 * deleted, not taken by "Delete all", and not confirmed or rewritten since.
 * The portrait would otherwise say what a memory said before the learner
 * changed it. The build fed at most `PORTRAIT_MEMORY_LIMIT`, and each is looked
 * up by its id.
 */
const isUnaltered = Effect.fn("nina.portrait.unaltered")(function* (
  userId: Docs["users"]["_id"],
  seen: readonly Seen[],
  clearedAt: number | undefined
) {
  const found = yield* Effect.forEach(seen, ({ id }) =>
    readKeptMemory(userId, id, clearedAt)
  );
  return Arr.every(
    found,
    (memory) => memory !== null && isUnchanged(seen, memory)
  );
});

/**
 * The sealed text a portrait holds after a build: the one it had when the build
 * wrote none, none when the build wrote an empty one, and the new text sealed
 * for the learner otherwise.
 */
const nextText = Effect.fn("nina.portrait.next")(function* (
  userId: Docs["users"]["_id"],
  written: string | undefined,
  current: Portrait["text"]
) {
  if (written === undefined) {
    return current;
  }
  if (written === "") {
    return;
  }
  return yield* sealText(
    yield* readLearnerKeys(userId),
    PORTRAIT_FIELD,
    written
  );
}, Effect.orDie);

/**
 * Stores what a build wrote, and tells whether it did. The model read the
 * memories some time ago, so the write first checks what could have changed
 * meanwhile, and writes nothing when:
 *
 * - the portrait is gone, or is not the one the claim read (`expected` is its
 *   `through`): the learner deleted all memories, deleted or rewrote one on the
 *   Memory page, which takes the text out and asks for a build of its own, or
 *   another build wrote first. A sentence that came from a memory the learner
 *   changed therefore never comes back;
 * - memory is paused;
 * - a memory the build fed to the model was deleted, taken by "Delete all", or
 *   changed since.
 *
 * Otherwise it moves `through` to `reached` and replaces the text with the new
 * one (an empty one removes it), or keeps it when the build wrote none. A
 * portrait left with no text for a learner with no memory at all is deleted:
 * nothing remains to remember. When `more` memories remain after the page the
 * build read, it also asks for the next build, which waits only for the quiet
 * and not for the day: the page it stored is not the whole of what the learner
 * has told Nina.
 *
 * The tokens of the model call the build made (`usage`) are added to the row
 * first, so they count whether or not the text is stored. A build whose answer
 * was rejected passes them alone, with no memory read and `reached` at the
 * `through` it started from, so they count and nothing else changes. A
 * portrait that is gone has no row to count them in. It reads at most 44
 * documents and writes two.
 */
export const savePortrait = Effect.fn("nina.portrait.keep")(function* (args: {
  readonly expected: number;
  readonly memories: readonly Seen[];
  readonly more: boolean;
  readonly reached: number;
  readonly text?: string | undefined;
  readonly usage?: Call | undefined;
  readonly userId: Docs["users"]["_id"];
}) {
  const { userId } = args;
  const row = yield* readPortraitRow(userId);
  if (row === null) {
    return false;
  }
  const writer = yield* DatabaseWriter;
  if (args.usage !== undefined) {
    yield* writer
      .table("ninaMemoryPortraits")
      .patch(row._id, {
        usage: {
          calls: (row.usage?.calls ?? 0) + 1,
          input: (row.usage?.input ?? 0) + args.usage.input,
          output: (row.usage?.output ?? 0) + args.usage.output,
        },
      })
      .pipe(Effect.orDie);
  }
  if (row.through !== args.expected) {
    return false;
  }
  const { clearedAt, paused } = yield* readMemoryState(userId);
  if (paused || !(yield* isUnaltered(userId, args.memories, clearedAt))) {
    return false;
  }
  const text = yield* nextText(userId, args.text, row.text);
  if (
    text === undefined &&
    Arr.isReadonlyArrayEmpty(yield* readNewest(userId, 1, clearedAt))
  ) {
    yield* writer
      .table("ninaMemoryPortraits")
      .delete(row._id)
      .pipe(Effect.orDie);
    return true;
  }
  if (args.text !== undefined || args.reached !== row.through) {
    yield* writer
      .table("ninaMemoryPortraits")
      .patch(row._id, {
        text,
        through: args.reached,
        ...(args.more ? { scheduledAt: yield* Clock.currentTimeMillis } : {}),
      })
      .pipe(Effect.orDie);
  }
  if (args.more) {
    yield* (yield* Scheduler).runAfter(
      PORTRAIT_DELAY,
      refs.internal.nina.portrait.build.run,
      { userId }
    );
  }
  return true;
});
