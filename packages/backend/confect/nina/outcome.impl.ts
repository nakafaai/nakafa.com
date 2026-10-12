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

/*
 * What one call costs, whatever the chats hold. It reaches the Agent component
 * STEPS times to read and REWRITES times to update, seven times in all. A
 * mutation may spend only a short time in such calls: production refused a page
 * of 100 rows that cost up to five of them each, and that call was cut to ten
 * rows (nakafa #987).
 * What it reads is bounded by bytes, not by an assumed size of a message: a read
 * ends with the first message that takes it past PAGE_BYTES, and an update
 * reads its message up to three times (it gets it, patches it and gets it
 * again). The test measures a call over messages as large as a document can be.
 */

/** Messages one read of a thread returns at most. */
const PAGE = 20;

/**
 * Bytes at which a read of a thread stops. The read ends with the message that
 * takes it past this, so a page of large messages is short, never large.
 */
const PAGE_BYTES = 256 * 1024;

/** Reads one call takes at most. A read opens the next chat first when the chat before it is done. */
const STEPS = 4;

/** Messages one call rewrites at most. A page with more waits for the next call. */
const REWRITES = 3;

type Cursor = typeof OutcomeCursor.Type;
type Report = typeof OutcomeReport.Type;
type Doc = FunctionReturnType<
  typeof components.nina.messages.listMessagesByThreadId
>["page"][number];
type ToolPart = Extract<
  NonNullable<Doc["message"]>,
  { role: "tool" }
>["content"][number];
type Change = ReturnType<typeof changesOf>[number];

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

/**
 * A stored output that has no outcome yet. It may carry the old `failure` key.
 * Every other key is kept as it is.
 */
const UnsettledOutput = Schema.StructWithRest(
  Schema.Struct({
    artifacts: Schema.Array(Schema.Unknown),
    failure: Schema.optionalKey(FailureSchema),
    outcome: Schema.optionalKey(Schema.Never),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
);

/**
 * The output with the outcome the runner stores for it today, when it has no
 * outcome and the runner would give it one: it carries the old `failure` key,
 * or a card of it was lost. Anything in the output that does not read as a card
 * is left out when the cards are weighed.
 */
function settle(value: unknown) {
  return Option.flatMap(
    Schema.decodeUnknownOption(UnsettledOutput)(value),
    ({ failure, ...kept }) =>
      Option.map(
        Option.fromNullishOr(
          settleOutcome(
            failure === undefined ? undefined : OUTCOME_OF[failure],
            Arr.filter(kept.artifacts, Schema.is(CapabilityArtifactSchema))
          )
        ),
        (outcome) => ({ ...kept, outcome })
      )
  );
}

/** The tool result with a settled output, when it is the result of a capability with an unsettled one. */
function rewritePart(part: ToolPart) {
  if (
    part.type !== "tool-result" ||
    part.output?.type !== "json" ||
    !Schema.is(LearningCapabilityNameSchema)(part.toolName)
  ) {
    return Option.none();
  }
  const output = part.output;
  return Option.map(settle(output.value), (value) => ({
    ...part,
    output: { ...output, value },
  }));
}

/** The message with every unsettled capability output settled, or none when it has none. */
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

/** The messages of a page that hold an unsettled output, each with its rewrite. */
function changesOf(docs: readonly Doc[]) {
  return Arr.getSomes(
    Arr.map(docs, (doc) =>
      Option.map(rewriteMessage(doc.message), (message) => ({
        message,
        messageId: doc._id,
      }))
    )
  );
}

/** Replaces one stored message through the Agent component's own update function. */
const update = Effect.fn("nina.outcome.update")(function* ({
  message,
  messageId,
}: Change) {
  const ctx = yield* MutationCtx;
  yield* Effect.promise(() =>
    ctx.runMutation(components.nina.messages.updateMessage, {
      messageId,
      patch: { message },
    })
  );
});

/**
 * One page of one thread to read, and where the list of chats goes on once the
 * thread is done. `from` is null for the first page of a thread.
 */
function pageOf(after: string | null, from: string | null, threadId: string) {
  return { after, from, threadId };
}

/**
 * The page a read takes. Inside a thread the cursor says it. Otherwise it is the
 * first page of the next chat, and none after the last chat.
 */
const locate = Effect.fn("nina.outcome.locate")(function* (cursor: Cursor) {
  if (cursor.messages) {
    return Option.some(
      pageOf(cursor.chats, cursor.messages.cursor, cursor.messages.threadId)
    );
  }
  const chats = (yield* DatabaseReader)
    .table("chats")
    .stream("by_creation_time");
  const page = yield* QueryStream.paginate(chats, {
    cursor: cursor.chats,
    numItems: 1,
  }).pipe(Effect.orDie);
  return Option.map(Arr.head(page.page), (chat) =>
    pageOf(page.continueCursor, null, chat.threadId)
  );
});

/**
 * One read: a page of a thread, every status, oldest first, and the rewrite of
 * the messages in it that hold an unsettled output, as many as `budget` allows.
 * A page that holds more leaves the cursor where it was, so the next read takes
 * it again and finds what is left. The pass is done when no chat is left.
 */
const advance = Effect.fn("nina.outcome.advance")(function* (
  cursor: Cursor,
  budget: number
) {
  const target = yield* locate(cursor);
  if (Option.isNone(target)) {
    return { cursor: null, rewritten: 0, scanned: 0 };
  }
  const { after, from, threadId } = target.value;
  const ctx = yield* MutationCtx;
  const page = yield* Effect.promise(() =>
    ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
      order: "asc",
      paginationOpts: {
        cursor: from,
        maximumBytesRead: PAGE_BYTES,
        numItems: PAGE,
      },
      threadId,
    })
  );
  const changes = changesOf(page.page);
  const batch = Arr.take(changes, budget);
  yield* Effect.forEach(batch, update, { discard: true });
  const finished = batch.length === changes.length;
  return {
    cursor: finished
      ? {
          chats: after,
          messages: page.isDone
            ? null
            : { cursor: page.continueCursor, threadId },
        }
      : cursor,
    rewritten: batch.length,
    scanned: page.page.length,
  };
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
      const read: Report = yield* advance(
        report.cursor,
        REWRITES - report.rewritten
      );
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
