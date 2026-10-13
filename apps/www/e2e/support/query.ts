import {
  AgentMessage,
  type MessagePage,
} from "@repo/backend/confect/nina/contract/message";
import { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import { Array as Arr, MutableHashMap, Option, Schema } from "effect";
import type { SentSchema } from "@/e2e/support/frames";

/** The Convex name of `nina.messages.page`, the query that reads the messages of a chat. */
const MESSAGES = "nina/messages:page";
/** The Convex name of `nina.conversation.turns`, the query that reads the turns that ended. */
const TURNS = "nina/conversation:turns";

/** One message as the query that reads a chat's messages returns it. */
export type StoredMessage = (typeof MessagePage.Type)["page"][number];

/**
 * A message of a served chat with the facts of its turn. A message that answers
 * a turn carries them here, and the served page strips them: the query that
 * reads messages tells none of a turn, and the turns query tells them.
 */
const ServedMessage = Schema.Struct({
  ...AgentMessage.fields,
  metadata: Schema.optional(NinaTurnSummary),
});
export type ServedMessage = typeof ServedMessage.Type;

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
export const cutPage = <Item>(
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
export const pageOf = (
  messages: readonly StoredMessage[],
  cursor: string | null,
  numItems: number
) => ({
  ...cutPage(messages, cursor, numItems),
  streams: { kind: "list", messages: [] },
});
