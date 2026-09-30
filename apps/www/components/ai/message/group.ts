import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { isToolUIPart } from "ai";

type MessagePart = NinaMessage["parts"][number];

/** An answer text part, which paces while it streams. */
export type AnswerPart = Extract<MessagePart, { type: "text" }>;

/** Every rendered part other than answer text. */
export type OtherPart = Exclude<MessagePart, { type: "step-start" | "text" }>;

interface PartEntry {
  readonly key: string;
  readonly part: OtherPart;
  readonly type: "part";
}

interface AnswerEntry {
  readonly key: string;
  readonly part: AnswerPart;
  /** Response parts after the answer, such as its sources. */
  readonly trailing: PartEntry[];
  readonly type: "answer";
}

type MessageEntry = AnswerEntry | PartEntry;

/** One run of consecutive work steps or answer parts. */
export interface MessageGroup {
  readonly entries: MessageEntry[];
  readonly key: string;
  readonly kind: "activity" | "response";
}

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
  const counts = new Map<string, number>();
  for (const part of parts) {
    if (
      part.type === "step-start" ||
      (part.type === "text" && part.text.trim().length === 0)
    ) {
      continue;
    }
    const tool = isToolUIPart(part);
    const kind = part.type === "reasoning" || tool ? "activity" : "response";
    const count = counts.get(part.type) ?? 0;
    counts.set(part.type, count + 1);
    const key = tool ? part.toolCallId : `${part.type}-${count}`;
    const entry: MessageEntry =
      part.type === "text"
        ? { key, part, trailing: [], type: "answer" }
        : { key, part, type: "part" };
    const group = groups.at(-1);
    if (group?.kind !== kind) {
      groups.push({ entries: [entry], key, kind });
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
