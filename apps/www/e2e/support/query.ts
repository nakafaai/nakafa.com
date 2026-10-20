import type {
  AgentMessage,
  MessagePage,
} from "@repo/backend/confect/nina/contract/message";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import { Array as Arr, MutableHashMap, Option, Schema, Struct } from "effect";
import type { SentSchema } from "./frames";

/** The Convex name of `nina.messages.page`, the query that reads the messages of a chat. */
const MESSAGES = "nina/messages:page";
/** The Convex name of `nina.conversation.turns`, the query that reads the turns that ended. */
const TURNS = "nina/conversation:turns";
/** The Convex name of `nina.conversation.get`, the query that reads a chat with its latest turn. */
export const CONVERSATION = "nina/conversation:get";
/** The stream that carries the answer being written. */
const STREAM_ID = "prose-stream";

/** One message as the query that reads a chat's messages returns it. */
export type StoredMessage = (typeof MessagePage.Type)["page"][number];

/**
 * A message of a served chat with the facts of its turn. A message that answers
 * a turn carries them here, and the served page strips them: the query that
 * reads messages tells none of a turn, and the turns query tells them. Only
 * types come from the contracts here: Playwright loads this file as CommonJS,
 * and the contract of a turn reaches a package that loads only as ES modules.
 */
export type ServedMessage = typeof AgentMessage.Type &
  Partial<Record<"metadata", typeof NinaTurnSummary.Type>>;

const TurnsArguments = Schema.Tuple([
  Schema.Struct({
    paginationOpts: Schema.Struct({
      cursor: Schema.NullOr(Schema.String),
      numItems: Schema.Finite,
    }),
  }),
]);
const decodeTurnsArguments = Schema.decodeUnknownOption(TurnsArguments);

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
export const Asked = Schema.Union([
  Schema.Struct({
    cursor: Schema.NullOr(Schema.String),
    kind: Schema.Literal("page"),
    numItems: Schema.Finite,
  }),
  Schema.Struct({ kind: Schema.Literal("list") }),
  Schema.Struct({ cursor: Schema.Finite, kind: Schema.Literal("deltas") }),
  Schema.Struct({
    cursor: Schema.NullOr(Schema.String),
    kind: Schema.Literal("turns"),
    numItems: Schema.Finite,
  }),
]);

/** What a query of a connection asks for, by its id. */
export type AskedQueries = MutableHashMap.MutableHashMap<
  number,
  typeof Asked.Type
>;

const decodeArguments = Schema.decodeUnknownOption(MessagesArguments);

/** What a query with these arguments asks for, if it is one of ours. */
const askedBy = (udfPath: string, args: readonly unknown[]) => {
  if (udfPath === TURNS) {
    return Option.map(
      decodeTurnsArguments(args),
      ([{ paginationOpts }]) =>
        ({
          cursor: paginationOpts.cursor,
          kind: "turns",
          numItems: paginationOpts.numItems,
        }) satisfies typeof Asked.Type
    );
  }
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
export const noticeQueries = (
  asked: AskedQueries,
  frame: typeof SentSchema.Type
) => {
  if (frame.type !== "ModifyQuerySet") {
    return;
  }
  for (const change of frame.modifications) {
    if (change.type === "Remove") {
      MutableHashMap.remove(asked, change.queryId);
    }
    if (
      change.type !== "Add" ||
      (change.udfPath !== MESSAGES && change.udfPath !== TURNS)
    ) {
      continue;
    }
    const { udfPath } = change;
    const query = Option.flatMap(Option.fromNullishOr(change.args), (args) =>
      askedBy(udfPath, args)
    );

    if (Option.isSome(query)) {
      MutableHashMap.set(asked, change.queryId, query.value);
    }
  }
};

/**
 * Pages items the way Agent's list does: the newest first, `numItems` at a time,
 * and a cursor that names where the next page starts.
 */
const cutPage = <Item>(
  items: readonly Item[],
  cursor: string | null,
  numItems: number
) => {
  const newestFirst = Arr.reverse(items);
  const start = cursor === null ? 0 : Number.parseInt(cursor, 10);
  const page = Arr.take(Arr.drop(newestFirst, start), numItems);
  const end = start + page.length;
  return {
    continueCursor: `${end}`,
    isDone: end >= newestFirst.length,
    page,
  };
};

/** Pages the messages of a chat, as the query that reads them does. */
const pageOf = (
  messages: readonly StoredMessage[],
  cursor: string | null,
  numItems: number
) => ({
  ...cutPage(messages, cursor, numItems),
  streams: { kind: "list", messages: [] },
});

/** What the page is writing: the order of the message whose answer streams, and the chunks written so far. */
const WritingSchema = Schema.Struct({
  chunks: Schema.Array(Schema.Unknown),
  order: Schema.NullOr(Schema.Finite),
});
export type Writing = typeof WritingSchema.Type;

/**
 * The value one query of a page is given, from the messages the chat holds and
 * the answer being written. A page of messages is cut from them the way the
 * server cuts it, and a page of turns from the turns the messages carry. A
 * stream gives the chunks of the answer from the cursor the page asks for.
 */
export const answerTo = (
  asked: typeof Asked.Type,
  messages: readonly ServedMessage[],
  writing: Writing
) => {
  if (asked.kind === "page") {
    return pageOf(
      Arr.map(messages, Struct.omit(["metadata"])),
      asked.cursor,
      asked.numItems
    );
  }
  if (asked.kind === "turns") {
    return cutPage(
      Arr.flatMap(messages, (message) =>
        message.metadata === undefined ? [] : [message.metadata]
      ),
      asked.cursor,
      asked.numItems
    );
  }
  const base = { continueCursor: "", isDone: true, page: [] };
  if (asked.kind === "list") {
    return {
      ...base,
      streams: {
        kind: "list",
        messages:
          writing.order === null
            ? []
            : [
                {
                  format: "UIMessageChunk",
                  order: writing.order,
                  status: "streaming",
                  stepOrder: 1,
                  streamId: STREAM_ID,
                },
              ],
      },
    };
  }
  const parts = Arr.drop(writing.chunks, asked.cursor);
  return {
    ...base,
    streams: {
      deltas: Arr.isReadonlyArrayNonEmpty(parts)
        ? [
            {
              end: writing.chunks.length,
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
