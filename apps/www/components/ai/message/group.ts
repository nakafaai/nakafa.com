import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { isToolUIPart, type StepStartUIPart, type TextUIPart } from "ai";
import { Array as Arr, MutableHashMap, MutableList, Option } from "effect";

type MessagePart = NinaMessage["parts"][number];

/** An answer text part, which paces while it streams. */
export type AnswerPart = Extract<MessagePart, TextUIPart>;

/** Every rendered part other than answer text. */
export type OtherPart = Exclude<MessagePart, StepStartUIPart | TextUIPart>;

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

/** An answer entry while its trailing parts are still arriving. */
interface AnswerBuilder {
  readonly key: string;
  readonly part: AnswerPart;
  readonly trailing: MutableList.MutableList<PartEntry>;
  readonly type: "answer";
}

type EntryBuilder = AnswerBuilder | PartEntry;

/** A group while its entries are still arriving. */
interface GroupBuilder {
  readonly entries: MutableList.MutableList<EntryBuilder>;
  readonly key: string;
  readonly kind: MessageGroup["kind"];
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
  const groups = MutableList.make<GroupBuilder>();
  const counts = MutableHashMap.empty<string, number>();
  let group: GroupBuilder | undefined;
  let previous: EntryBuilder | undefined;
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
    const entry: EntryBuilder =
      part.type === "text"
        ? { key, part, trailing: MutableList.make<PartEntry>(), type: "answer" }
        : { key, part, type: "part" };
    if (group === undefined || group.kind !== kind) {
      group = { entries: MutableList.make<EntryBuilder>(), key, kind };
      MutableList.append(groups, group);
      previous = undefined;
    }
    if (entry.type === "part" && previous?.type === "answer") {
      MutableList.append(previous.trailing, entry);
      continue;
    }
    MutableList.append(group.entries, entry);
    previous = entry;
  }
  return Arr.map(MutableList.toArray(groups), (builder) => ({
    entries: Arr.map(MutableList.toArray(builder.entries), finishEntry),
    key: builder.key,
    kind: builder.kind,
  }));
}

/** Converts an entry's builder into the shape the view reads. */
function finishEntry(entry: EntryBuilder): MessageEntry {
  return entry.type === "part"
    ? entry
    : {
        key: entry.key,
        part: entry.part,
        trailing: MutableList.toArray(entry.trailing),
        type: "answer",
      };
}
