import { expect, type Page } from "@playwright/test";
import type { MessagePage } from "@repo/backend/confect/nina/contract/message";
import {
  Array as Arr,
  Effect,
  MutableHashMap,
  MutableList,
  Option,
  Predicate,
  Result,
  Schema,
} from "effect";
import { openChatPage } from "@/e2e/support/chat";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The realtime connection of the page to the backend. */
const CONVEX_SOCKET = /\/api\/[^/]+\/sync/;
/** The Convex name of `nina.messages.list`, the query that reads the messages of a chat. */
const MESSAGES = "nina/messages:list";
/** The stream that carries the answer being written. */
const STREAM_ID = "prose-stream";

/** One message as the query that reads a chat's messages returns it. */
export type StoredMessage = (typeof MessagePage.Type)["page"][number];

/** The rows of a transcript: one for each message, and the alert of the chat's failed turn after them. */
export const ROW = '[data-slot="message-scroller-item"]';

/** A frame of the protocol, whatever it holds. */
const Frame = Schema.fromJsonString(Schema.Unknown);
const decodeFrame = Schema.decodeUnknownOption(Frame);
const encodeFrame = Schema.encodeSync(Frame);

/** A query the page adds to its set, with the arguments it asks with. */
const AddedQuery = Schema.Struct({
  args: Schema.Array(Schema.Unknown),
  queryId: Schema.Finite,
  type: Schema.Literal("Add"),
  udfPath: Schema.String,
});

/** A query the page drops from its set. */
const RemovedQuery = Schema.Struct({
  queryId: Schema.Finite,
  type: Schema.Literal("Remove"),
});

/** The frame that carries the queries a page adds or removes. */
const QuerySet = Schema.Struct({
  modifications: Schema.Array(Schema.Unknown),
  type: Schema.Literal("ModifyQuerySet"),
});

/** What a messages query asks for: a page, or the streams of the chat. */
const MessagesArguments = Schema.Tuple([
  Schema.Struct({
    paginationOpts: Schema.Struct({
      cursor: Schema.NullOr(Schema.String),
      numItems: Schema.Finite,
    }),
    streamArgs: Schema.optionalKey(
      Schema.Union([
        Schema.Struct({ kind: Schema.Literal("list") }),
        Schema.Struct({
          cursors: Schema.Array(
            Schema.Struct({ cursor: Schema.Finite, streamId: Schema.String })
          ),
          kind: Schema.Literal("deltas"),
        }),
      ])
    ),
  }),
]);

/** What one query of a connection asks for, which decides the value it is given. */
const Asked = Schema.Union([
  Schema.Struct({
    cursor: Schema.NullOr(Schema.String),
    kind: Schema.Literal("page"),
    numItems: Schema.Finite,
  }),
  Schema.Struct({ kind: Schema.Literal("list") }),
  Schema.Struct({ cursor: Schema.Finite, kind: Schema.Literal("deltas") }),
]);

/**
 * A change the server tells the page of that names a query's answer: its new
 * value, or the failure of a query the server could not run, such as a page
 * that starts at a cursor of ours.
 */
const Answer = Schema.Struct({
  queryId: Schema.Finite,
  type: Schema.Literals(["QueryUpdated", "QueryFailed"]),
});

/** A frame in which the server moves the page to a new view of the database. */
const Transition = Schema.Struct({
  clientClockSkew: Schema.optionalKey(Schema.Unknown),
  endVersion: Schema.Unknown,
  modifications: Schema.Array(Schema.Unknown),
  serverTs: Schema.optionalKey(Schema.Unknown),
  type: Schema.Literal("Transition"),
});

const isQuerySet = Schema.is(QuerySet);
const isAnswer = Schema.is(Answer);
const decodeAdded = Schema.decodeUnknownResult(AddedQuery);
const decodeRemoved = Schema.decodeUnknownResult(RemovedQuery);
const decodeArguments = Schema.decodeUnknownOption(MessagesArguments);
const decodeTransition = Schema.decodeUnknownOption(Transition);

/** What a query of a connection asks for, by its id. */
type AskedQueries = MutableHashMap.MutableHashMap<number, typeof Asked.Type>;

/** The answer of the messages query with these arguments: what it asks for, if it is one of ours. */
const askedBy = (args: readonly unknown[]) => {
  const decoded = decodeArguments(args);

  if (Option.isNone(decoded)) {
    return Option.none<typeof Asked.Type>();
  }
  const [{ paginationOpts, streamArgs }] = decoded.value;

  if (streamArgs === undefined) {
    return Option.some<typeof Asked.Type>({
      cursor: paginationOpts.cursor,
      kind: "page",
      numItems: paginationOpts.numItems,
    });
  }
  if (streamArgs.kind === "list") {
    return Option.some<typeof Asked.Type>({ kind: "list" });
  }
  return Option.some<typeof Asked.Type>({
    cursor: Option.match(Arr.head(streamArgs.cursors), {
      onNone: () => 0,
      onSome: (entry) => entry.cursor,
    }),
    kind: "deltas",
  });
};

/** Notes the messages queries a frame of the page adds to its set, and the queries it drops. */
const noticeQueries = (asked: AskedQueries, frame: unknown) => {
  if (!isQuerySet(frame)) {
    return;
  }
  for (const removed of Arr.filterMap(frame.modifications, (change) =>
    decodeRemoved(change)
  )) {
    MutableHashMap.remove(asked, removed.queryId);
  }
  for (const added of Arr.filterMap(frame.modifications, (change) =>
    decodeAdded(change)
  )) {
    const query = askedBy(added.args);

    if (added.udfPath === MESSAGES && Option.isSome(query)) {
      MutableHashMap.set(asked, added.queryId, query.value);
    }
  }
};

/**
 * Pages the messages the way Agent's list does: the newest first, `numItems` at
 * a time, and a cursor that names where the next page starts.
 */
const pageOf = (
  messages: readonly StoredMessage[],
  cursor: string | null,
  numItems: number
) => {
  const newestFirst = Arr.reverse(messages);
  const start = cursor === null ? 0 : Number.parseInt(cursor, 10);
  const page = Arr.take(Arr.drop(newestFirst, start), numItems);
  const end = start + page.length;
  return {
    continueCursor: `${end}`,
    isDone: end >= newestFirst.length,
    page,
    streams: { kind: "list", messages: [] },
  };
};

/**
 * Makes the page read `messages` as the transcript of the chat it shows. The
 * stored transcript of a chat comes from the model, which the local backend
 * has not got, so the frames the server sends for the messages query carry
 * these messages instead, and nothing in the page knows the difference: it asks
 * for pages, and the pages are cut from the list the way the server cuts them.
 * Call it before the page opens its connection, which is before the page loads.
 *
 * It returns the way to write an answer while the page watches: `begin` opens
 * a stream of the turn `turn`, `push` gives the page more of its chunks, and
 * `finish` ends it. The page asks for the stream the way it does for Nina's
 * own, so each chunk goes through the same code a model's would.
 */
const serveMessages = Effect.fn("NakafaE2E.serveMessages")(function* (
  page: Page,
  messages: readonly StoredMessage[]
) {
  /** The chunks of the answer being written, and the turn it answers. */
  const chunks = MutableList.make<unknown>();
  let order: number | null = null;
  let finished = false;
  /** Each connection of the page: what it asked, how to reach it, and the view it last held. */
  const connections = MutableList.make<{
    readonly asked: AskedQueries;
    readonly send: (frame: string) => void;
    view: Option.Option<typeof Transition.Type>;
  }>();

  /** The value one query is given, from the messages and the answer being written. */
  const answerTo = (asked: typeof Asked.Type) => {
    if (asked.kind === "page") {
      return pageOf(messages, asked.cursor, asked.numItems);
    }
    const base = { continueCursor: "", isDone: true, page: [] };
    if (asked.kind === "list") {
      return {
        ...base,
        streams: {
          kind: "list",
          messages:
            order === null
              ? []
              : [
                  {
                    format: "UIMessageChunk",
                    order,
                    status: finished ? "finished" : "streaming",
                    stepOrder: 1,
                    streamId: STREAM_ID,
                  },
                ],
        },
      };
    }
    const all = MutableList.toArray(chunks);
    const parts = Arr.drop(all, asked.cursor);
    return {
      ...base,
      streams: {
        deltas: Arr.isReadonlyArrayNonEmpty(parts)
          ? [
              {
                end: all.length,
                parts,
                start: asked.cursor,
                streamId: STREAM_ID,
              },
            ]
          : [],
        kind: "deltas",
      },
    };
  };

  /** Gives every connection the new value of the queries a change moves. */
  const refresh = (reads: (asked: typeof Asked.Type) => boolean) => {
    for (const connection of MutableList.toArray(connections)) {
      if (Option.isNone(connection.view)) {
        continue;
      }
      const { clientClockSkew, endVersion, serverTs } = connection.view.value;
      const changes = Arr.filterMap(
        Arr.fromIterable(connection.asked),
        ([queryId, asked]) =>
          reads(asked)
            ? Result.succeed({
                journal: null,
                logLines: [],
                queryId,
                type: "QueryUpdated",
                value: answerTo(asked),
              })
            : Result.failVoid
      );
      if (Arr.isReadonlyArrayNonEmpty(changes)) {
        // The page already stands at this view, so the frame starts and ends there.
        connection.send(
          encodeFrame({
            ...(clientClockSkew === undefined ? {} : { clientClockSkew }),
            endVersion,
            modifications: changes,
            ...(serverTs === undefined ? {} : { serverTs }),
            startVersion: endVersion,
            type: "Transition",
          })
        );
      }
    }
  };

  /** A frame of the server with the answers of our queries replaced by ours. */
  const answered = (
    asked: AskedQueries,
    frame: unknown,
    transition: typeof Transition.Type
  ) =>
    encodeFrame({
      ...(Predicate.isObject(frame) ? frame : {}),
      modifications: Arr.map(transition.modifications, (change) => {
        if (!isAnswer(change)) {
          return change;
        }
        const query = MutableHashMap.get(asked, change.queryId);
        return Option.isNone(query)
          ? change
          : {
              journal: null,
              logLines: [],
              queryId: change.queryId,
              type: "QueryUpdated",
              value: answerTo(query.value),
            };
      }),
    });

  yield* Effect.promise(() =>
    page.routeWebSocket(CONVEX_SOCKET, (socket) => {
      const server = socket.connectToServer();
      const connection = {
        asked: MutableHashMap.empty<number, typeof Asked.Type>(),
        send: (frame: string) => socket.send(frame),
        view: Option.none<typeof Transition.Type>(),
      };
      MutableList.append(connections, connection);

      socket.onMessage((message) => {
        noticeQueries(
          connection.asked,
          Option.getOrUndefined(decodeFrame(message.toString()))
        );
        server.send(message);
      });

      server.onMessage((message) => {
        const frame = decodeFrame(message.toString());
        const transition = Option.flatMap(frame, decodeTransition);

        if (Option.isNone(frame) || Option.isNone(transition)) {
          socket.send(message);
          return;
        }
        connection.view = transition;
        socket.send(answered(connection.asked, frame.value, transition.value));
      });
    })
  );

  return {
    /** Opens the stream of the answer to the turn `turn`, with nothing written yet. */
    begin(turn: number) {
      order = turn;
      refresh((asked) => asked.kind === "list");
    },
    /** Ends the stream: the answer is whole. */
    finish() {
      finished = true;
      refresh((asked) => asked.kind === "list");
    },
    /** Gives the page the chunks of the answer, in order, as the model writes them. */
    push(more: readonly unknown[]) {
      for (const chunk of more) {
        MutableList.append(chunks, chunk);
      }
      refresh((asked) => asked.kind === "deltas");
    },
  };
});

/**
 * Signs a synthetic learner in, starts a chat that the local backend cannot
 * answer, and opens its page in `locale` with `messages` as its transcript. It
 * returns the way to write an answer while the page watches, once the first
 * row of the transcript shows.
 */
export const openServedChat = Effect.fn("NakafaE2E.openServedChat")(function* (
  page: Page,
  baseURL: string,
  messages: readonly StoredMessage[],
  locale = "en"
) {
  const { learner } = yield* openChatPage(page, baseURL);
  const chat = yield* learner.startChat("A question that the page replaces");
  const served = yield* serveMessages(page, messages);

  yield* Effect.promise(async () => {
    await page.goto(`/${locale}/chat/${chat.chatId}`);
    await expect(page.locator(ROW).first()).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
  });
  return served;
});
