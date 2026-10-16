import type { Page } from "@playwright/test";
import type { chatViewValidator } from "@repo/backend/confect/chats/view";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import {
  Array as Arr,
  Effect,
  MutableHashMap,
  MutableHashSet,
  type MutableRef,
  Option,
  Schema,
} from "effect";
import {
  answerQueriesIn,
  CONVEX_SOCKET,
  decodeSent,
  type SentSchema,
} from "@/e2e/support/frames";
import {
  type AskedQueries,
  answerTo,
  CONVERSATION,
  noticeQueries,
  type ServedMessage,
  type Writing,
} from "@/e2e/support/query";
import { THREAD } from "@/e2e/support/transcript/message";

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

/**
 * Serves the conversation that `shown` holds to a page. The page reads a chat
 * through its conversation and its messages, and the server answers both as
 * failures, because the chat is not stored. So the page's own realtime frames
 * are the door: the answers the server sends for those queries are replaced
 * with what the fixture holds, the way the messages server answers them, and
 * every other frame passes through. A page that opens after `shown` changed
 * reads the new conversation.
 */
export const serveConversation = Effect.fn("NakafaE2E.serveConversation")(
  function* (
    page: Page,
    shown: MutableRef.MutableRef<readonly ServedMessage[]>
  ) {
    yield* Effect.promise(() =>
      page.routeWebSocket(CONVEX_SOCKET, (socket) => {
        const server = socket.connectToServer();
        /** What each message and turn query of this connection asks for, and the conversation queries. */
        const asked: AskedQueries = MutableHashMap.empty();
        const conversations = MutableHashSet.empty<number>();

        /** The answer to a query of this connection that the fixture serves, and none for any other. */
        const answerOf = (queryId: number): Option.Option<unknown> => {
          const query = MutableHashMap.get(asked, queryId);
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

        socket.onMessage((message) => {
          const sent = decodeSent(message.toString());
          if (Option.isSome(sent)) {
            noticeQueries(asked, sent.value);
            noticeConversations(conversations, sent.value);
          }
          server.send(message);
        });
        server.onMessage((message) => {
          const text = message.toString();
          socket.send(
            Option.getOrElse(answerQueriesIn(text, answerOf), () => text)
          );
        });
      })
    );
  }
);
