import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import {
  CapabilityDenied,
  denied,
} from "@repo/backend/confect/nina/policy/capability";
import { formatFound } from "@repo/backend/confect/nina/prompt/recall";
import { Array as Arr, Clock, Effect, Schema } from "effect";

/**
 * Why the memory capability is denied while the learner has paused memory. The
 * policy decides it for a turn from its context, and the run decides it again
 * for a call, because the learner may pause while the turn runs.
 */
export const MEMORY_PAUSED = denied(
  "The learner paused memory, so what they told Nina before is not available. Tell the learner you cannot look it up while memory is paused."
);

/**
 * The search of the learner's memories could not be read. It keeps nothing of
 * the failure, because the call was given the learner's query and what the
 * platform says of a failed call is not ours to keep.
 */
export class MemoryReadError extends Schema.TaggedError<MemoryReadError>()(
  "MemoryReadError",
  {}
) {}

/** Ends a read that failed in any way, without its message. */
function unreadable() {
  return new MemoryReadError();
}

/** What Nina reads when no saved memory matches her query. */
const NOTHING =
  "No saved memory matches this query. The learner may never have told Nina. Say you do not know it yet, ask them, and do not guess it.";

/**
 * Runs the memory capability: the search of the learner's memories for Nina's
 * query, at most 6, each nearly in full and the whole answer within 1,500
 * tokens, or one line that says nothing was found. It makes no model call and
 * writes nothing, so a memory it returns is not thereby confirmed. It only ever
 * reads the memories of the learner the turn belongs to. The capability policy
 * has allowed the call from the turn's context, but the learner may have paused
 * memory since the turn began, so a paused memory refuses here too, with the
 * denial the policy gives (`MEMORY_PAUSED`).
 *
 * The words it finds are the text of its answer. The capability declares a note
 * (see `memoryCapability`), so the shared runner holds the words for the model's
 * next step and the conversation stores the note, never the words.
 *
 * The search is the one call here that can fail for a reason outside the code.
 * Confect raises a call that the platform rejected as a defect, because
 * `QueryRunner` passes it no way to map the error, and an answer that does not
 * fit the contract of the search as a `SchemaError`. Both end at that call as a
 * `MemoryReadError`, so the capability can answer a failed read, and any other
 * defect stays a bug that someone sees.
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
    .pipe(
      Effect.mapError(unreadable),
      Effect.catchDefect(() => Effect.fail(unreadable()))
    );
  if (paused) {
    return yield* new CapabilityDenied({ reason: MEMORY_PAUSED.reason });
  }
  if (!Arr.isReadonlyArrayNonEmpty(memories)) {
    return { outcome: "empty" as const, text: NOTHING };
  }
  return { text: formatFound(memories) };
});
