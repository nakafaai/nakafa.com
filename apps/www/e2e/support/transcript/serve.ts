import type { Page } from "@playwright/test";
import type { chatViewValidator } from "@repo/backend/confect/chats/view";
import type { MessagePage } from "@repo/backend/confect/nina/contract/message";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import {
  Array as Arr,
  Effect,
  MutableHashMap,
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
} from "@/e2e/support/frames";
import { THREAD } from "@/e2e/support/transcript/message";

/** The Convex names of the two queries that give a chat its messages. */
const CONVERSATION = "nina/conversation:get";
const MESSAGES = "nina/messages:list";

/** The socket of the page's realtime connection, as Playwright routes it. */
type Socket = Parameters<Parameters<Page["routeWebSocket"]>[1]>[0];

/** A stream was asked for before the page's connection read the chat. */
class NoConnection extends Schema.TaggedError<NoConnection>()("NoConnection", {
  message: Schema.String,
}) {}

/** The id of the fixture chat. The page takes any string for the id of a chat. */
export const CHAT = "e2e-evidence-chat";

/**
 * What the page calls the queries of a chat with: the chat, and for the
 * messages the stream it asks for, which only a request of the stream carries.
 */
const decodeChatArgs = Schema.decodeUnknownOption(
  Schema.Struct({
    chatId: Schema.String,
    streamArgs: Schema.optionalKey(Schema.Unknown),
  })
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

/** What `nina.messages.list` returns, as the wire holds it. */
type Messages = typeof MessagePage.Encoded;

/** The conversation of the fixture chat: its chat, and the turn that ran last. */
function conversationOf(messages: readonly NinaMessage[]): Conversation {
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

/** The transcript of the fixture chat, with no stream beside it. */
function transcriptOf(messages: readonly NinaMessage[]): Messages {
  return {
    continueCursor: "end",
    isDone: true,
    page: [...messages],
    streams: { kind: "list", messages: [] },
  };
}

/** What the page reads next to the transcript: the streams of a chat, and none is live. */
const STREAMS: Messages = {
  continueCursor: "",
  isDone: true,
  page: [],
  streams: { kind: "list", messages: [] },
};

/** The queries of one connection that read the fixture chat, by id, with the answer each gets. */
type Served = MutableHashMap.MutableHashMap<number, unknown>;

/**
 * Remembers which queries a change of the page's query set adds for the
 * fixture chat, and forgets the ones it drops. A query for any other chat, or
 * for anything else, is left to the server.
 */
function noticeChange(
  served: Served,
  shown: MutableRef.MutableRef<readonly NinaMessage[]>,
  transcript: MutableRef.MutableRef<Option.Option<number>>,
  text: string
) {
  const frame = decodeSent(text);
  if (Option.isNone(frame) || frame.value.type !== "ModifyQuerySet") {
    return;
  }
  for (const modification of frame.value.modifications) {
    if (modification.type === "Remove") {
      MutableHashMap.remove(served, modification.queryId);
      continue;
    }
    const args = Option.fromNullishOr(modification.args).pipe(
      Option.flatMap(Arr.head),
      Option.flatMap(decodeChatArgs)
    );
    if (Option.isNone(args) || args.value.chatId !== CHAT) {
      continue;
    }
    if (modification.udfPath === CONVERSATION) {
      MutableHashMap.set(
        served,
        modification.queryId,
        conversationOf(shown.current)
      );
    }
    if (modification.udfPath === MESSAGES) {
      if (args.value.streamArgs === undefined) {
        MutableRef.set(transcript, Option.some(modification.queryId));
      }
      MutableHashMap.set(
        served,
        modification.queryId,
        args.value.streamArgs === undefined
          ? transcriptOf(shown.current)
          : STREAMS
      );
    }
  }
}

/**
 * Puts the answer of the fixture chat in place of every result the server
 * sends for one of its queries. A frame that is no transition, and a result
 * of any other query, pass through as they are.
 */
function replaceResults(served: Served, text: string) {
  return Option.getOrElse(
    answerQueriesIn(text, (queryId) => MutableHashMap.get(served, queryId)),
    () => text
  );
}

/**
 * Serves the conversation that `shown` holds to a page. The page reads a chat
 * through two queries, the conversation and its messages, and both come back
 * from the server as failures, because the chat is not stored. So the page's
 * own realtime frames are the door: the answers the server sends for those
 * queries are replaced with the conversation, and every other frame passes
 * through. A page that opens after `shown` changed reads the new conversation.
 */
export const serveConversation = Effect.fn("NakafaE2E.serveConversation")(
  function* (page: Page, shown: MutableRef.MutableRef<readonly NinaMessage[]>) {
    const socket = MutableRef.make<Option.Option<Socket>>(Option.none());
    const version = MutableRef.make<Option.Option<unknown>>(Option.none());
    const transcript = MutableRef.make<Option.Option<number>>(Option.none());

    yield* Effect.promise(() =>
      page.routeWebSocket(CONVEX_SOCKET, (route) => {
        const server = route.connectToServer();
        const served: Served = MutableHashMap.empty();

        MutableRef.set(socket, Option.some(route));
        route.onMessage((message) => {
          noticeChange(served, shown, transcript, message.toString());
          server.send(message);
        });
        server.onMessage((message) => {
          const text = message.toString();
          const transition = decodeTransition(text);
          if (Option.isSome(transition)) {
            MutableRef.set(version, Option.some(transition.value.endVersion));
          }
          route.send(replaceResults(served, text));
        });
      })
    );

    return {
      /**
       * Puts `messages` in front of the page as a new answer of the transcript,
       * the way Agent does while a turn streams. The connection keeps the version
       * it holds, so the page reads the answer as one more update of the same
       * query. It fails until the page's connection has read the transcript.
       */
      stream: Effect.fn("NakafaE2E.streamChat")(function* (
        messages: readonly NinaMessage[]
      ) {
        const open = MutableRef.get(socket);
        const current = MutableRef.get(version);
        const query = MutableRef.get(transcript);
        if (
          Option.isNone(open) ||
          Option.isNone(current) ||
          Option.isNone(query)
        ) {
          return yield* new NoConnection({
            message: "The page has not read the chat yet.",
          });
        }
        MutableRef.set(shown, messages);
        open.value.send(
          encodeTransition({
            endVersion: current.value,
            modifications: [
              {
                journal: null,
                logLines: [],
                queryId: query.value,
                type: "QueryUpdated",
                value: transcriptOf(messages),
              },
            ],
            startVersion: current.value,
            type: "Transition",
          })
        );
      }),
    };
  }
);
