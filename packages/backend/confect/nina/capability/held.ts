import type { ModelMessage } from "ai";
import { Array as Arr, MutableHashMap, Option, Schema } from "effect";

/** The call that an answer belongs to: the tool and the id of its call. */
const HeldCall = Schema.Struct({
  toolCallId: Schema.String,
  toolName: Schema.String,
});

/**
 * The answers of one turn that the conversation must not store, by the call that
 * made each. A capability that declares a note leaves its words here and stores
 * the note, so a public chat's transcript, a later turn, and a memory the learner
 * deleted hold no copy of them. A turn makes the map and drops it when it ends.
 */
export type Held = MutableHashMap.MutableHashMap<typeof HeldCall.Type, string>;

/**
 * Puts the words that a call held back into its result, for the next step of
 * the turn that made the call. The result the conversation stored has only the
 * note, so a step that reads the thread, such as a later turn, reads the note.
 * A result with nothing held for it, or whose tool is not the one that held, stays
 * as it is.
 */
export function restoreHeld(messages: readonly ModelMessage[], held: Held) {
  return Arr.map(messages, (message): ModelMessage => {
    if (message.role !== "tool") {
      return message;
    }
    return {
      ...message,
      content: Arr.map(message.content, (part) => {
        if (part.type !== "tool-result") {
          return part;
        }
        return Option.match(
          MutableHashMap.get(held, {
            toolCallId: part.toolCallId,
            toolName: part.toolName,
          }),
          {
            onNone: () => part,
            onSome: (words) => ({
              ...part,
              output: { type: "text" as const, value: words },
            }),
          }
        );
      }),
    };
  });
}
