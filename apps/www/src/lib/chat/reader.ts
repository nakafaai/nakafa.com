import { Id } from "@repo/backend/confect/_generated/id";
import { shareTokenValidator } from "@repo/backend/confect/chats/schema";
import { chatViewValidator } from "@repo/backend/confect/chats/view";
import { AgentId } from "@repo/backend/confect/nina/contract/message";
import { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { Schema } from "effect";

/** A reader's request for a shared chat: the chat id, and the token its link carries. */
export const ReaderChatRequest = Schema.Struct({
  chatId: Id("chats"),
  shareToken: shareTokenValidator,
});

/**
 * One older page of a shared chat. Its messages always load. Its turns load
 * with them only while the turns have more, so `turnsCursor` is absent once
 * the turns are all read.
 */
export const ReaderPageRequest = Schema.Struct({
  chatId: Id("chats"),
  messagesCursor: Schema.String,
  shareToken: shareTokenValidator,
  threadId: AgentId,
  turnsCursor: Schema.optionalKey(Schema.String),
});

/** One page of a list the server reads, with the cursor of the page after it. */
const ReaderPage = <Item extends Schema.Top>(item: Item) =>
  Schema.Struct({
    continueCursor: Schema.String,
    isDone: Schema.Boolean,
    page: Schema.mutable(Schema.Array(item)),
  });

/**
 * A message as the server sends it to a reader: Agent's UI message without its
 * metadata, which the transcript never reads. TanStack serializes the answer by
 * its type, and an optional `unknown` metadata field is not serializable.
 */
type ReaderMessageShape = Omit<NinaMessage, "metadata">;

/**
 * A message of the transcript: Agent's UI message, whose parts are an AI SDK
 * shape that no Schema describes as data. The predicate checks every typed field
 * of the message, and only the list of its parts, whose items no Schema
 * describes. The server decodes each message it returns through it.
 */
const ReaderMessageFields = Schema.Struct({
  _creationTime: Schema.Finite,
  id: Schema.String,
  key: Schema.String,
  order: Schema.Finite,
  parts: Schema.Array(Schema.Unknown),
  role: Schema.Literals(["system", "user", "assistant"]),
  status: Schema.Literals(["streaming", "pending", "success", "failed"]),
  stepOrder: Schema.Finite,
  text: Schema.String,
});

/** A message of the transcript, as its guard reads it. */
export const ReaderMessage = Schema.declare(
  (input: unknown): input is ReaderMessageShape =>
    Schema.is(ReaderMessageFields)(input)
);

/**
 * One page of messages, as the JSON text that encodes it. TanStack types a
 * server answer for serialization and rejects the `unknown` data of an AI SDK
 * part, so a page crosses the wire as its text, and the client decodes it
 * through the same shape.
 */
export const ReaderMessagePage = Schema.fromJsonString(
  Schema.Array(ReaderMessage)
);

/** A page of messages as the server sends it: the JSON text of its messages, and the cursor after them. */
const ReaderMessagesPage = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  json: Schema.String,
});

/**
 * What the server answers for a shared chat. A chat the token does not open is
 * `unavailable`, which is what a chat that is gone answers too. A chat it opens
 * carries the chat, its latest turn, and the first page of its messages and of
 * its settled turns.
 */
export const ReaderReady = Schema.Struct({
  chat: chatViewValidator,
  messages: ReaderMessagesPage,
  status: Schema.Literal("ready"),
  turn: Schema.NullOr(NinaTurnSummary),
  turns: ReaderPage(NinaTurnSummary),
});
export type ReaderReady = typeof ReaderReady.Type;

export const ReaderRead = Schema.Union([
  Schema.Struct({ status: Schema.Literal("unavailable") }),
  ReaderReady,
]);
export type ReaderRead = typeof ReaderRead.Type;

/**
 * An older page of a shared chat: its messages, and its turns when they were
 * asked for. The answer leaves `turns` out when they were not asked for.
 */
export const ReaderOlder = Schema.Struct({
  messages: ReaderMessagesPage,
  turns: Schema.optionalKey(ReaderPage(NinaTurnSummary)),
});
export type ReaderOlder = typeof ReaderOlder.Type;
