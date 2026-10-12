import type { Page } from "@playwright/test";
import type { chatViewValidator } from "@repo/backend/confect/chats/view";
import type { MessagePage } from "@repo/backend/confect/nina/contract/message";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import {
  Array as Arr,
  Effect,
  MutableHashMap,
  type MutableRef,
  Option,
  Schema,
} from "effect";
import { THREAD } from "@/e2e/support/transcript/message";

/** The realtime connection of the page to the backend. */
const CONVEX_SOCKET = /\/api\/[^/]+\/sync/;

/** The Convex names of the two queries that give a chat its messages. */
const CONVERSATION = "nina/conversation:get";
const MESSAGES = "nina/messages:list";

/** The id of the fixture chat. The page takes any string for the id of a chat. */
export const CHAT = "e2e-evidence-chat";

/** A frame as JSON text: the keys the protocol gives it, and whatever else it carries. */
const Frame = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown)
);

/** The change of the query set that the page sends: the queries it adds and drops. */
const Change = Schema.Struct({
  modifications: Schema.Array(
    Schema.Union([
      Schema.Struct({
        args: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
        queryId: Schema.Finite,
        type: Schema.Literal("Add"),
        udfPath: Schema.String,
      }),
      Schema.Struct({
        queryId: Schema.Finite,
        type: Schema.Literal("Remove"),
      }),
    ])
  ),
  type: Schema.Literal("ModifyQuerySet"),
});

/** The answer of the server that carries query results. */
const Transition = Schema.Struct({
  modifications: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
  type: Schema.Literal("Transition"),
});

/** The query of one result in a transition. */
const Result = Schema.Struct({ queryId: Schema.Finite });

const decodeChange = Schema.decodeUnknownOption(Schema.fromJsonString(Change));
const decodeFrame = Schema.decodeUnknownOption(Frame);
const encodeFrame = Schema.encodeSync(Frame);
const isTransition = Schema.is(Transition);
const isResult = Schema.is(Result);

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
  text: string
) {
  const change = decodeChange(text);
  if (Option.isNone(change)) {
    return;
  }
  for (const modification of change.value.modifications) {
    if (modification.type === "Remove") {
      MutableHashMap.remove(served, modification.queryId);
      continue;
    }
    const [args] = modification.args;
    if (args?.chatId !== CHAT) {
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
      MutableHashMap.set(
        served,
        modification.queryId,
        args.streamArgs === undefined ? transcriptOf(shown.current) : STREAMS
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
  const frame = decodeFrame(text);
  if (Option.isNone(frame) || !isTransition(frame.value)) {
    return text;
  }
  const modifications = Arr.map(frame.value.modifications, (result) => {
    if (!isResult(result)) {
      return result;
    }
    return Option.match(MutableHashMap.get(served, result.queryId), {
      onNone: () => result,
      onSome: (value) => ({
        journal: null,
        logLines: [],
        queryId: result.queryId,
        type: "QueryUpdated",
        value,
      }),
    });
  });
  return encodeFrame({ ...frame.value, modifications });
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
    yield* Effect.promise(() =>
      page.routeWebSocket(CONVEX_SOCKET, (socket) => {
        const server = socket.connectToServer();
        const served: Served = MutableHashMap.empty();

        socket.onMessage((message) => {
          noticeChange(served, shown, message.toString());
          server.send(message);
        });
        server.onMessage((message) => {
          socket.send(replaceResults(served, message.toString()));
        });
      })
    );
  }
);
