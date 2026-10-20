import type { Page } from "@playwright/test";
import type { chatViewValidator } from "@repo/backend/confect/chats/view";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import {
  Array as Arr,
  Effect,
  MutableHashMap,
  MutableHashSet,
  MutableRef,
  Option,
  Schema,
} from "effect";
import {
  answerQueriesIn,
  CONVEX_SOCKET,
  decodeSent,
  decodeTransition,
  encodeTransition,
  type SentSchema,
} from "../frames";
import {
  type AskedQueries,
  answerTo,
  CONVERSATION,
  noticeQueries,
  type ServedMessage,
  type Writing,
} from "../query";
import { THREAD } from "./message";

/** The socket of the page's realtime connection, as Playwright routes it. */
type Socket = Parameters<Parameters<Page["routeWebSocket"]>[1]>[0];

/** A stream was asked for before the page's connection read the chat. */
class NoConnection extends Schema.TaggedError<NoConnection>()("NoConnection", {
  message: Schema.String,
}) {}

/** The id of the fixture chat. The page takes any string for the id of a chat. */
export const CHAT = "e2e-evidence-chat";

/** The fixture writes no answer while the page watches, so a stream is empty. */
const NOTHING_WRITTEN: Writing = { chunks: [], order: null };

/** What the page calls the conversation with: the chat it reads. */
const decodeChatArgs = Schema.decodeUnknownOption(
  Schema.Struct({ chatId: Schema.String })
);

/** The fields of a chat as readers receive it. */
type ChatFields = typeof chatViewValidator.fields;

/**
 * What `nina.conversation.get` returns, as the wire holds it. The type is made
 * from the backend's own schemas, so a field they changed fails the typecheck.
 * The ids of the chat are strings here: the brand of a Convex id exists only in
 * the types, and nothing in a browser test makes a branded value.
 */
type Conversation = Schema.Struct<{
  readonly chat: Schema.Struct<
    Omit<ChatFields, "_id" | "userId"> & {
      readonly _id: typeof Schema.String;
      readonly userId: typeof Schema.String;
    }
  >;
  readonly turn: Schema.NullOr<typeof NinaTurnSummary>;
}>["Encoded"];

/**
 * The conversation of the fixture chat: its chat, and the turn that ran last.
 * The turn comes from the messages that answer it, whose facts the messages
 * query does not tell.
 */
function conversationOf(messages: readonly ServedMessage[]): Conversation {
  const last = Arr.findLast(
    messages,
    (message) => message.role === "assistant"
  );
  return {
    chat: {
      _creationTime: 0,
      _id: CHAT,
      threadId: THREAD,
      title: "Evidence",
      type: "study",
      updatedAt: 0,
      userId: "e2e-learner",
      visibility: "private",
    },
    turn: Option.getOrNull(
      Option.flatMapNullishOr(last, (message) => message.metadata)
    ),
  };
}

/**
 * Remembers which conversation queries a change of the page's query set adds
 * for the fixture chat, and forgets the ones it drops. A conversation of any
 * other chat is left to the server.
 */
function noticeConversations(
  conversations: MutableHashSet.MutableHashSet<number>,
  frame: typeof SentSchema.Type
) {
  if (frame.type !== "ModifyQuerySet") {
    return;
  }
  for (const modification of frame.modifications) {
    if (modification.type === "Remove") {
      MutableHashSet.remove(conversations, modification.queryId);
      continue;
    }
    if (modification.udfPath !== CONVERSATION) {
      continue;
    }
    const chat = Option.fromNullishOr(modification.args).pipe(
      Option.flatMap(Arr.head),
      Option.flatMap(decodeChatArgs)
    );
    if (Option.isSome(chat) && chat.value.chatId === CHAT) {
      MutableHashSet.add(conversations, modification.queryId);
    }
  }
}

/** Whether the page has read a page of messages, which a stream must update. */
const readsMessages = (asked: AskedQueries) =>
  Arr.some(
    Arr.fromIterable(MutableHashMap.values(asked)),
    (query) => query.kind === "page"
  );

/**
 * Serves the conversation that `shown` holds to a page. The page reads a chat
 * through its conversation and its messages, and the server answers both as
 * failures, because the chat is not stored. So the page's own realtime frames
 * are the door: the answers the server sends for those queries are replaced
 * with what the fixture holds, the way the messages server answers them, and
 * every other frame passes through. A page that opens after `shown` changed
 * reads the new conversation. The `stream` it returns puts new messages in
 * front of a page that is open.
 */
export const serveConversation = Effect.fn("NakafaE2E.serveConversation")(
  function* (
    page: Page,
    shown: MutableRef.MutableRef<readonly ServedMessage[]>
  ) {
    /** The socket of the latest connection of the page, which a stream writes to. */
    const socket = MutableRef.make<Option.Option<Socket>>(Option.none());
    /** What the queries of that connection ask for, as `noticeQueries` records it. */
    const asked = MutableRef.make<Option.Option<AskedQueries>>(Option.none());
    /** The version that the server sent last on that connection. A stream answers with it. */
    const version = MutableRef.make<Option.Option<unknown>>(Option.none());

    yield* Effect.promise(() =>
      page.routeWebSocket(CONVEX_SOCKET, (route) => {
        const server = route.connectToServer();
        /** What each message and turn query of this connection asks for, and the conversation queries. */
        const queries: AskedQueries = MutableHashMap.empty();
        const conversations = MutableHashSet.empty<number>();
        MutableRef.set(socket, Option.some(route));
        MutableRef.set(asked, Option.some(queries));
        MutableRef.set(version, Option.none());

        /** The answer to a query of this connection that the fixture serves, and none for any other. */
        const answerOf = (queryId: number): Option.Option<unknown> => {
          const query = MutableHashMap.get(queries, queryId);
          if (Option.isSome(query)) {
            return Option.some(
              answerTo(query.value, shown.current, NOTHING_WRITTEN)
            );
          }
          if (MutableHashSet.has(conversations, queryId)) {
            return Option.some(conversationOf(shown.current));
          }
          return Option.none();
        };

        route.onMessage((message) => {
          const sent = decodeSent(message.toString());
          if (Option.isSome(sent)) {
            noticeQueries(queries, sent.value);
            noticeConversations(conversations, sent.value);
          }
          server.send(message);
        });
        server.onMessage((message) => {
          const text = message.toString();
          const transition = decodeTransition(text);
          if (Option.isSome(transition)) {
            MutableRef.set(version, Option.some(transition.value.endVersion));
          }
          route.send(
            Option.getOrElse(answerQueriesIn(text, answerOf), () => text)
          );
        });
      })
    );

    return {
      /**
       * Puts `messages` in front of the page as the new answer of its chat, the
       * way Agent does while a turn streams. Every query the page asked of its
       * messages takes the new answer, with the version the connection holds, so
       * the page reads the change as one more update of the same queries. It
       * fails until the page's connection has read the messages of the chat.
       */
      stream: Effect.fn("NakafaE2E.streamChat")(function* (
        messages: readonly ServedMessage[]
      ) {
        const live = Option.all({
          asked: MutableRef.get(asked),
          socket: MutableRef.get(socket),
          version: MutableRef.get(version),
        });
        if (Option.isNone(live) || !readsMessages(live.value.asked)) {
          return yield* new NoConnection({
            message: "The page has not read the chat yet.",
          });
        }
        const { asked: queries, socket: open, version: current } = live.value;
        MutableRef.set(shown, messages);
        const modifications = Arr.getSomes(
          Arr.map(Arr.fromIterable(MutableHashMap.keys(queries)), (queryId) =>
            Option.map(MutableHashMap.get(queries, queryId), (query) => ({
              journal: null,
              logLines: [],
              queryId,
              type: "QueryUpdated",
              value: answerTo(query, messages, NOTHING_WRITTEN),
            }))
          )
        );
        open.send(
          encodeTransition({
            endVersion: current,
            modifications,
            startVersion: current,
            type: "Transition",
          })
        );
      }),
    };
  }
);
