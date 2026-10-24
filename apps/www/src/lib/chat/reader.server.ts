import { HttpClient } from "@confect/js";
import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/client/nina/presentation";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Effect, Schema } from "effect";
import type {
  ReaderChatRequest,
  ReaderOlder,
  ReaderPageRequest,
  ReaderRead,
} from "@/lib/chat/reader";
import { ReaderMessage, ReaderMessagePage } from "@/lib/chat/reader";
import { httpLayer } from "@/lib/convex/http";
import { serverHandler } from "@/lib/server/fn";

/** The first page of a list, from its start. */
const FIRST_PAGE = { cursor: null, numItems: NINA_MESSAGES_PAGE_SIZE };

/**
 * Checks each message of a page against the transcript's message shape, and
 * encodes the page as the JSON text the client decodes. Agent's page is an
 * envelope whose parts Confect does not type, so a message without the shape of
 * an Agent UI message is a defect, not a message to skip.
 */
const encodeMessages = Effect.fn("www.chat.reader.messages")(function* (
  page: readonly unknown[]
) {
  const messages = yield* Effect.forEach(page, (message) =>
    Schema.decodeUnknownEffect(ReaderMessage)(message).pipe(Effect.orDie)
  );
  return yield* Schema.encodeEffect(ReaderMessagePage)(messages).pipe(
    Effect.orDie
  );
});

/**
 * A shared chat as its reader reads it: the chat, its latest turn, and the first
 * pages of its messages and of its settled turns. Convex checks the token on
 * every query, so a token that does not open the chat fails the first query
 * with the access error, and the reader gets no part of the chat.
 */
const readFirstPages = Effect.fn("www.chat.reader.read")(function* (
  request: typeof ReaderChatRequest.Type
) {
  const client = yield* HttpClient.HttpClient;
  const conversation = yield* client.query(nina.conversation.get, request);
  const turns = yield* client.query(nina.conversation.turns, {
    ...request,
    paginationOpts: FIRST_PAGE,
  });
  const messages = yield* client.query(nina.messages.page, {
    ...request,
    paginationOpts: FIRST_PAGE,
    threadId: conversation.chat.threadId,
  });
  const json = yield* encodeMessages(messages.page);
  return {
    chat: conversation.chat,
    messages: {
      continueCursor: messages.continueCursor,
      isDone: messages.isDone,
      json,
    },
    status: "ready",
    turn: conversation.turn,
    turns: {
      continueCursor: turns.continueCursor,
      isDone: turns.isDone,
      page: turns.page,
    },
  } satisfies ReaderRead;
});

/** The shared chat a reader's link opens, or `unavailable` when no token opens it. */
export const readReaderHandler = serverHandler(
  (request: typeof ReaderChatRequest.Type) =>
    readFirstPages(request).pipe(
      Effect.catchTag("ChatAccessError", () =>
        Effect.succeed<ReaderRead>({ status: "unavailable" })
      ),
      Effect.provide(httpLayer({}))
    )
);

/**
 * One older page of a shared chat's messages, with the turns that go with them
 * when the reader asked for them. Each page reads the cursor of the page before.
 */
const readOlderPages = Effect.fn("www.chat.reader.older")(function* (
  request: typeof ReaderPageRequest.Type
) {
  const client = yield* HttpClient.HttpClient;
  const { chatId, shareToken, threadId } = request;
  const messages = yield* client.query(nina.messages.page, {
    chatId,
    paginationOpts: {
      cursor: request.messagesCursor,
      numItems: NINA_MESSAGES_PAGE_SIZE,
    },
    shareToken,
    threadId,
  });
  const json = yield* encodeMessages(messages.page);
  const messagesPage = {
    continueCursor: messages.continueCursor,
    isDone: messages.isDone,
    json,
  };
  if (request.turnsCursor === undefined) {
    return { messages: messagesPage } satisfies ReaderOlder;
  }
  const turns = yield* client.query(nina.conversation.turns, {
    chatId,
    paginationOpts: {
      cursor: request.turnsCursor,
      numItems: NINA_MESSAGES_PAGE_SIZE,
    },
    shareToken,
  });
  return {
    messages: messagesPage,
    turns: {
      continueCursor: turns.continueCursor,
      isDone: turns.isDone,
      page: turns.page,
    },
  } satisfies ReaderOlder;
});

/** One older page of a shared chat, for the reader who holds its token. */
export const readReaderOlderHandler = serverHandler(
  (request: typeof ReaderPageRequest.Type) =>
    readOlderPages(request).pipe(Effect.provide(httpLayer({})))
);
