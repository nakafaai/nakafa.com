import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { formatFound } from "@repo/backend/confect/nina/prompt/recall";
import { Array as Arr, Clock, Effect } from "effect";

/** What Nina reads when the learner paused memory while her turn ran. */
const PAUSED =
  "The learner paused memory, so what they told Nina before is not available. Use only what is in this conversation, tell the learner you cannot look it up while memory is paused, and do not guess it.";

/** What Nina reads when no saved memory matches her query. */
const NOTHING =
  "No saved memory matches this query. The learner may never have told Nina. Say you do not know it yet, ask them, and do not guess it.";

/**
 * Runs the memory capability: the search of the learner's memories for Nina's
 * query, at most 6, each nearly in full and the whole answer within 1,500
 * tokens, or one line that says nothing was found. It makes no model call and
 * writes nothing, so a memory it returns is not thereby confirmed. It only ever
 * reads the memories of the learner the turn belongs to. While memory is paused
 * it refuses, as a policy does.
 */
export const runMemory = Effect.fn("nina.memory.tool")(function* ({
  query,
  userId,
}: {
  readonly query: string;
  readonly userId: Docs["users"]["_id"];
}) {
  const { memories, paused } = yield* (yield* QueryRunner)
    .runQuery(refs.internal.nina.memory.lookup, {
      now: yield* Clock.currentTimeMillis,
      query,
      userId,
    })
    .pipe(Effect.orDie);
  if (paused) {
    return { outcome: "denied" as const, text: PAUSED };
  }
  if (!Arr.isReadonlyArrayNonEmpty(memories)) {
    return { outcome: "empty" as const, text: NOTHING };
  }
  return { text: formatFound(memories) };
});
