import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { MEMORY_CAPABILITY } from "@repo/backend/confect/nina/capability/spec";
import { formatFound } from "@repo/backend/confect/nina/prompt/recall";
import type { ModelMessage } from "ai";
import { Array as Arr, Clock, Effect, MutableHashMap, Option } from "effect";

/**
 * What the memory calls of one turn found, as the words Nina reads, by the id of
 * the call. A turn makes the map and drops it when it ends. The words must never
 * be stored: a result that the chat keeps is readable in the transcript of a
 * public chat, is read again by every later turn, and outlives the memory it
 * came from.
 */
export type Found = MutableHashMap.MutableHashMap<string, string>;

/** What Nina reads when the learner paused memory while her turn ran. */
const PAUSED =
  "The learner paused memory, so what they told Nina before is not available. Use only what is in this conversation, tell the learner you cannot look it up while memory is paused, and do not guess it.";

/** What Nina reads when no saved memory matches her query. */
const NOTHING =
  "No saved memory matches this query. The learner may never have told Nina. Say you do not know it yet, ask them, and do not guess it.";

/**
 * What the conversation keeps of a search that found memories, and what a later
 * turn reads of it. The words are read once, in the step after the call.
 */
const KEPT =
  "Saved memories matched this query, but their words are not kept in the conversation. Search again when the learner asks about them.";

/**
 * Runs the memory capability: the search of the learner's memories for Nina's
 * query, at most 6, each nearly in full and the whole answer within 1,500
 * tokens, or one line that says nothing was found. It makes no model call and
 * writes nothing, so a memory it returns is not thereby confirmed. It only ever
 * reads the memories of the learner the turn belongs to. While memory is paused
 * it refuses, as a policy does.
 *
 * What it finds goes into `found` under the id of the call, for the model's
 * next step (`restoreFound`), and the answer it returns, which the conversation
 * stores, carries none of the words.
 */
export const runMemory = Effect.fn("nina.memory.tool")(function* ({
  found,
  query,
  toolCallId,
  userId,
}: {
  readonly found: Found;
  readonly query: string;
  readonly toolCallId: string;
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
  MutableHashMap.set(found, toolCallId, formatFound(memories));
  return { text: KEPT };
});

/**
 * Puts the words that a memory call found back into its result, for the next
 * step of the turn that made the call. The result the conversation stored has
 * only the note, so a step that reads the thread, such as a later turn, reads
 * the note. A result with nothing held for it stays as it is.
 */
export function restoreFound(messages: readonly ModelMessage[], found: Found) {
  return Arr.map(messages, (message): ModelMessage => {
    if (message.role !== "tool") {
      return message;
    }
    return {
      ...message,
      content: Arr.map(message.content, (part) => {
        if (
          part.type !== "tool-result" ||
          part.toolName !== MEMORY_CAPABILITY
        ) {
          return part;
        }
        return Option.match(MutableHashMap.get(found, part.toolCallId), {
          onNone: () => part,
          onSome: (words) => ({
            ...part,
            output: { type: "text" as const, value: words },
          }),
        });
      }),
    };
  });
}
