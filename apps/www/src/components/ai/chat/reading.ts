import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { Array as Arr, Number as Num, Order, Result, Schema } from "effect";
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

/**
 * The messages of one page, decoded from the JSON text the server sent. A page
 * that does not decode is a failed read, which shows its failure card, so the
 * reader is not thrown into the error page of the route.
 */
function decodeMessages(json: string) {
  return Schema.decodeResult(ReaderMessagePage)(json);
}

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

/** The first pages of a chat, with the messages of the first page decoded. */
function firstView(read: ReaderReady, messages: readonly NinaMessage[]) {
  return {
    chat: read.chat,
    endedTurns: read.turns.page,
    messages: orderMessages(messages),
    messagesCursor: cursorAfter(read.messages),
    turn: read.turn,
    turnsCursor: cursorAfter(read.turns),
  };
}

/** The chat a reader sees: its chat and turns, and every page loaded so far. */
export type ReaderView = ReturnType<typeof firstView>;

/**
 * The view of a chat the server answered as readable: its first pages. A page of
 * messages that does not decode fails the view.
 */
export function readerView(read: ReaderReady) {
  return Result.map(decodeMessages(read.messages.json), (messages) =>
    firstView(read, messages)
  );
}

/**
 * Adds an older page to the view. Its messages come before those shown, and its
 * turns join the ended turns when the reader asked for them, each turn once.
 */
export function withOlderPage(view: ReaderView, older: ReaderOlder) {
  const turns = older.turns;
  return Result.map(decodeMessages(older.messages.json), (messages) => ({
    ...view,
    endedTurns:
      turns === undefined
        ? view.endedTurns
        : Arr.dedupeWith(
            [...view.endedTurns, ...turns.page],
            (left, right) => left.order === right.order
          ),
    messages: orderMessages([...messages, ...view.messages]),
    messagesCursor: cursorAfter(older.messages),
    turnsCursor: turns === undefined ? view.turnsCursor : cursorAfter(turns),
  }));
}
