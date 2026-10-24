import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { Array as Arr, Number as Num, Order, Schema } from "effect";
import {
  ReaderMessagePage,
  type ReaderOlder,
  type ReaderReady,
} from "@/lib/chat/reader";

/** A reader's chat could not be read from the server, so the page offers to try again. */
export class ReaderReadError extends Schema.TaggedError<ReaderReadError>()(
  "ReaderReadError",
  { cause: Schema.Unknown }
) {}

/** The messages of one page, decoded from the JSON text the server sent. */
function decodeMessages(json: string) {
  return Schema.decodeSync(ReaderMessagePage)(json);
}

/** The chat a reader sees: its chat and turns, and every page loaded so far. */
export type ReaderView = ReturnType<typeof readerView>;

/** The transcript's messages in the order a conversation reads them: by prompt, then by step. */
const byStep = Order.combine(
  Order.mapInput(Num.Order, (message: NinaMessage) => message.order),
  Order.mapInput(Num.Order, (message: NinaMessage) => message.stepOrder)
);

/** Orders the messages of every page read so far, and keeps each message once. */
function orderMessages(messages: readonly NinaMessage[]) {
  return Arr.dedupeWith(
    Arr.sort(messages, byStep),
    (left: NinaMessage, right: NinaMessage) => left.key === right.key
  );
}

/** The cursor of the page after a list's page, or none once the list is read. */
function cursorAfter(list: {
  readonly continueCursor: string;
  readonly isDone: boolean;
}) {
  return list.isDone ? undefined : list.continueCursor;
}

/** The view of a chat the server answered as readable: its first pages. */
export function readerView(read: ReaderReady) {
  return {
    chat: read.chat,
    endedTurns: read.turns.page,
    messages: orderMessages(decodeMessages(read.messages.json)),
    messagesCursor: cursorAfter(read.messages),
    turn: read.turn,
    turnsCursor: cursorAfter(read.turns),
  };
}

/**
 * Adds an older page to the view. Its messages come before those shown, and its
 * turns join the ended turns when the reader asked for them.
 */
export function withOlderPage(
  view: ReaderView,
  older: ReaderOlder
): ReaderView {
  const turns = older.turns;
  return {
    ...view,
    endedTurns:
      turns === null
        ? view.endedTurns
        : Arr.appendAll(view.endedTurns, turns.page),
    messages: orderMessages([
      ...decodeMessages(older.messages.json),
      ...view.messages,
    ]),
    messagesCursor: cursorAfter(older.messages),
    turnsCursor: turns === null ? view.turnsCursor : cursorAfter(turns),
  };
}
