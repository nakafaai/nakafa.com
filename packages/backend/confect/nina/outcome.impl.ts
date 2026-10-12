import { FunctionImpl, GroupImpl, QueryStream } from "@confect/server";
import {
  CapabilityArtifactSchema,
  type CapabilityOutcomeSchema,
} from "@repo/backend/client/nina/capability";
import { components } from "@repo/backend/confect/_generated/components";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { settleOutcome } from "@repo/backend/confect/nina/capability/progress";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
import spec, {
  type OutcomeCursor,
  type OutcomeReport,
} from "@repo/backend/confect/nina/outcome.spec";
import type { FunctionReturnType } from "convex/server";
import { Array as Arr, Effect, Layer, Option, Schema } from "effect";

/** Messages one read of a thread returns. */
const PAGE = 20;

/**
 * Steps one call takes at most. A step reads one page of a thread, and opens
 * the next chat first when the chat before it is done.
 */
const STEPS = 5;

/** Messages one call rewrites at most, checked between steps. */
const REWRITES = 5;

type Cursor = typeof OutcomeCursor.Type;
type Report = typeof OutcomeReport.Type;
type Doc = FunctionReturnType<
  typeof components.nina.messages.listMessagesByThreadId
>["page"][number];
type ToolPart = Extract<
  NonNullable<Doc["message"]>,
  { role: "tool" }
>["content"][number];

/** The `failure` values a capability output carried until 10 October 2026. */
const FailureSchema = Schema.Literals(["failed", "denied", "sourceLimit"]);

/** The outcome each old failure becomes, before the cards beside it are weighed. */
const OUTCOME_OF = {
  denied: "denied",
  failed: "failed",
  sourceLimit: "limit",
} as const satisfies Record<
  typeof FailureSchema.Type,
  typeof CapabilityOutcomeSchema.Type
>;

/** A stored output that still has the old key. Every other key is kept as it is. */
const FailedOutput = Schema.StructWithRest(
  Schema.Struct({
    artifacts: Schema.Array(Schema.Unknown),
    failure: FailureSchema,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
);

/**
 * The tool result with the `outcome` its old `failure` stands for, when it is
 * the result of a capability whose output still has that key. Anything in the
 * output that does not read as a card is left out when the cards are weighed.
 */
function rewritePart(part: ToolPart) {
  if (
    part.type !== "tool-result" ||
    part.output?.type !== "json" ||
    !Schema.is(LearningCapabilityNameSchema)(part.toolName)
  ) {
    return Option.none();
  }
  const output = part.output;
  return Option.map(
    Schema.decodeUnknownOption(FailedOutput)(output.value),
    ({ failure, ...kept }) => ({
      ...part,
      output: {
        ...output,
        value: {
          ...kept,
          outcome: settleOutcome(
            OUTCOME_OF[failure],
            Arr.filter(kept.artifacts, Schema.is(CapabilityArtifactSchema))
          ),
        },
      },
    })
  );
}

/** The message with every old capability output rewritten, or none when it has none. */
function rewriteMessage(message: Doc["message"]) {
  if (message?.role !== "tool") {
    return Option.none();
  }
  const rewrites = Arr.map(message.content, rewritePart);
  if (!Arr.some(rewrites, Option.isSome)) {
    return Option.none();
  }
  return Option.some({
    ...message,
    content: Arr.zipWith(message.content, rewrites, (part, rewrite) =>
      Option.getOrElse(rewrite, () => part)
    ),
  });
}

/** Rewrites the messages of a page that hold an old output. It returns how many. */
const rewritePage = Effect.fn("nina.outcome.rewrite")(function* (
  docs: readonly Doc[]
) {
  const ctx = yield* MutationCtx;
  const changes = Arr.getSomes(
    Arr.map(docs, (doc) =>
      Option.map(rewriteMessage(doc.message), (message) => ({
        message,
        messageId: doc._id,
      }))
    )
  );
  yield* Effect.forEach(
    changes,
    ({ message, messageId }) =>
      Effect.promise(() =>
        ctx.runMutation(components.nina.messages.updateMessage, {
          messageId,
          patch: { message },
        })
      ),
    { discard: true }
  );
  return changes.length;
});

/**
 * Reads one page of a thread, every status, oldest first, and rewrites what it
 * holds. `after` is where the list of chats continues once the thread is done.
 */
const readPage = Effect.fn("nina.outcome.page")(function* (
  after: string | null,
  threadId: string,
  from: string | null
) {
  const ctx = yield* MutationCtx;
  const page = yield* Effect.promise(() =>
    ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
      order: "asc",
      paginationOpts: { cursor: from, numItems: PAGE },
      threadId,
    })
  );
  const rewritten = yield* rewritePage(page.page);
  return {
    cursor: {
      chats: after,
      messages: page.isDone ? null : { cursor: page.continueCursor, threadId },
    },
    rewritten,
    scanned: page.page.length,
  };
});

/** Reads the next chat after `cursor`, with the cursor that continues after it. */
const readChat = Effect.fn("nina.outcome.chat")(function* (
  cursor: string | null
) {
  const chats = (yield* DatabaseReader)
    .table("chats")
    .stream("by_creation_time");
  const page = yield* QueryStream.paginate(chats, {
    cursor,
    numItems: 1,
  }).pipe(Effect.orDie);
  return Option.map(Arr.head(page.page), (chat) => ({
    after: page.continueCursor,
    threadId: chat.threadId,
  }));
});

/**
 * One read: the next page of the thread the cursor is in, or the first page of
 * the next chat's thread. The pass is done when no chat is left.
 */
const advance = Effect.fn("nina.outcome.advance")(function* (cursor: Cursor) {
  if (cursor.messages) {
    return yield* readPage(
      cursor.chats,
      cursor.messages.threadId,
      cursor.messages.cursor
    );
  }
  const chat = yield* readChat(cursor.chats);
  if (Option.isNone(chat)) {
    return { cursor: null, rewritten: 0, scanned: 0 };
  }
  return yield* readPage(chat.value.after, chat.value.threadId, null);
});

const rewriteFailures = FunctionImpl.make(
  schema,
  spec,
  "rewriteFailures",
  Effect.fn("nina.outcome.rewriteFailures")(function* ({ cursor }) {
    let report: Report = {
      cursor: cursor ?? { chats: null, messages: null },
      rewritten: 0,
      scanned: 0,
    };
    for (
      let step = 0;
      report.cursor && step < STEPS && report.rewritten < REWRITES;
      step += 1
    ) {
      const read: Report = yield* advance(report.cursor);
      report = {
        cursor: read.cursor,
        rewritten: report.rewritten + read.rewritten,
        scanned: report.scanned + read.scanned,
      };
    }
    return report;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(rewriteFailures),
  GroupImpl.finalize
);
