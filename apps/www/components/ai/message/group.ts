import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { isToolUIPart, type StepStartUIPart, type TextUIPart } from "ai";
import { MutableHashMap, Option } from "effect";

type MessagePart = NinaMessage["parts"][number];

/** An answer text part, which paces while it streams. */
export type AnswerPart = Extract<MessagePart, TextUIPart>;

/** Every rendered part other than answer text. */
export type OtherPart = Exclude<MessagePart, StepStartUIPart | TextUIPart>;

/** A rendered part, keyed by its position among the parts of its type. */
function createPartEntry(key: string, part: OtherPart) {
  return { key, part, type: "part" as const };
}

/** An answer, which holds the response parts that follow it. */
function createAnswerEntry(key: string, part: AnswerPart) {
  /** Response parts after the answer, such as its sources. */
  const trailing: PartEntry[] = [];
  return { key, part, trailing, type: "answer" as const };
}

type PartEntry = ReturnType<typeof createPartEntry>;
type AnswerEntry = ReturnType<typeof createAnswerEntry>;
type MessageEntry = AnswerEntry | PartEntry;

function createMessageGroup(
  key: string,
  kind: "activity" | "response",
  entries: MessageEntry[]
) {
  return { entries, key, kind };
}

/** One run of consecutive work steps or answer parts. */
export type MessageGroup = ReturnType<typeof createMessageGroup>;

/**
 * Groups a message's parts into activity and response sections in Agent order.
 *
 * The streamed and saved copies of one message place step markers
 * differently, so parts are keyed by their position among parts of the same
 * type, and the saved copy replaces the stream in place. Response parts that
 * follow an answer belong to it, so the answer can hold them until its text
 * has finished pacing and its last lines never push them down.
 */
export function groupMessageParts(parts: readonly MessagePart[]) {
  const groups: MessageGroup[] = [];
  const counts = MutableHashMap.empty<string, number>();
  for (const part of parts) {
    if (
      part.type === "step-start" ||
      (part.type === "text" && part.text.trim().length === 0)
    ) {
      continue;
    }
    const tool = isToolUIPart(part);
    const kind = part.type === "reasoning" || tool ? "activity" : "response";
    const count = Option.getOrElse(
      MutableHashMap.get(counts, part.type),
      () => 0
    );
    MutableHashMap.set(counts, part.type, count + 1);
    const key = tool ? part.toolCallId : `${part.type}-${count}`;
    const entry: MessageEntry =
      part.type === "text"
        ? createAnswerEntry(key, part)
        : createPartEntry(key, part);
    const group = groups.at(-1);
    if (group?.kind !== kind) {
      groups.push(createMessageGroup(key, kind, [entry]));
      continue;
    }
    const previous = group.entries.at(-1);
    if (entry.type === "part" && previous?.type === "answer") {
      previous.trailing.push(entry);
      continue;
    }
    group.entries.push(entry);
  }
  return groups;
}
