import type { MessagePage } from "@repo/backend/confect/nina/contract/message";
import { Array as Arr, MutableHashMap, Option, Schema } from "effect";
import type { SentSchema } from "@/e2e/support/frames";

/** The Convex name of `nina.messages.list`, the query that reads the messages of a chat. */
const MESSAGES = "nina/messages:list";

/** One message as the query that reads a chat's messages returns it. */
export type StoredMessage = (typeof MessagePage.Type)["page"][number];

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
]);

/** What a query of a connection asks for, by its id. */
export type AskedQueries = MutableHashMap.MutableHashMap<
  number,
  typeof Asked.Type
>;

const decodeArguments = Schema.decodeUnknownOption(MessagesArguments);

/** What a messages query with these arguments asks for, if it is one of ours. */
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
    if (change.type !== "Add" || change.udfPath !== MESSAGES) {
      continue;
    }
    const query = Option.flatMap(Option.fromNullishOr(change.args), askedBy);

    if (Option.isSome(query)) {
      MutableHashMap.set(asked, change.queryId, query.value);
    }
  }
};

/**
 * Pages the messages the way Agent's list does: the newest first, `numItems` at
 * a time, and a cursor that names where the next page starts.
 */
export const pageOf = (
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
