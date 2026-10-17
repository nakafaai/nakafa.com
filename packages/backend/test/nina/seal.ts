import { RegisteredConvexFunction } from "@confect/server";
import { saveMessages, toModelMessage } from "@convex-dev/agent";
import type { MessageDoc } from "@convex-dev/agent/validators";
import { vMessageWithMetadata } from "@convex-dev/agent/validators";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  identityOf,
  openMessage,
  sealMessage,
} from "@repo/backend/confect/nina/sealed";
import { savePrompt } from "@repo/backend/confect/nina/sealed/save";
import type { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { parse } from "convex-helpers/validators";
import {
  Array as Arr,
  Effect,
  HashSet,
  Option,
  Predicate,
  Record as Rec,
  Schema,
  Struct,
} from "effect";

type LearnerId = Docs["users"]["_id"];

/** More rows than any fixture thread holds, so one read lists the whole thread. */
const WHOLE_THREAD = 1000;

/** One row replaced by its sealed copy: the id it had, and the id of the copy. */
export const Replacement = Schema.Struct({
  next: Schema.String,
  previous: Schema.String,
});
export type Replacement = typeof Replacement.Type;

/** The id that a row has after the seal: the id of its copy, or its own id when the seal kept it. */
export function copyOf(replacements: readonly Replacement[], id: string) {
  return Option.getOrElse(
    Arr.findFirst(replacements, (replacement) => replacement.previous === id),
    () => ({ next: id, previous: id })
  ).next;
}

/**
 * The rows of a thread in runs of one order and one agent, oldest first. The
 * Agent's writer takes one agent name for each write.
 */
function runsByOrder(rows: readonly MessageDoc[]) {
  if (!Arr.isReadonlyArrayNonEmpty(rows)) {
    return [];
  }
  return Arr.map(
    Arr.groupWith(
      rows,
      (self, that) =>
        self.order === that.order && self.agentName === that.agentName
    ),
    (run) => {
      const first = Arr.headNonEmpty(run);
      return { agentName: first.agentName, order: first.order, rows: run };
    }
  );
}

/** Points the turns that name a replaced prompt at the id of its copy. */
async function repointTurns(ctx: MutationCtx, replacement: Replacement) {
  const turns = await ctx.db
    .query("ninaTurns")
    .filter((query) =>
      query.eq(query.field("promptMessageId"), replacement.previous)
    )
    .collect();
  for (const turn of turns) {
    await ctx.db.patch(turn._id, { promptMessageId: replacement.next });
  }
}

/**
 * Writes every row of a thread again, in the same orders and steps, after opening
 * each row. A learner's row is written plain, or by `savePrompt` as `turns.start`
 * writes it (ADR 0024), which seals it for the learner who owns the thread. Every
 * other row is written plain, through the Agent's writer. The turns that name a
 * replaced learner's row point at its copy. Returns each replaced row with the id
 * of its copy.
 */
const rewriteThreadRows = Effect.fn("test.nina.seal.rewrite")(function* (
  threadId: string,
  owner: LearnerId,
  learnerRows: "plain" | "writer"
) {
  const ctx = yield* MutationCtx;
  const keys = yield* ensureLearnerKeys(owner);
  const { page } = yield* Effect.promise(() =>
    ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
      order: "asc",
      paginationOpts: { cursor: null, numItems: WHOLE_THREAD },
      threadId,
    })
  );
  yield* Effect.promise(() =>
    ctx.runMutation(components.nina.messages.deleteByIds, {
      messageIds: Arr.map(page, (row) => row._id),
    })
  );
  let replacements: readonly Replacement[] = [];
  // In writer mode a learner's message is saved by `savePrompt`, which takes the
  // next order of the thread. The learner's message shares its order with the rows
  // of its turn, so it is written first, and the rest of its run keeps the order
  // and the steps that it had.
  const writesPrompt = (row: MessageDoc) =>
    learnerRows === "writer" && row.message?.role === "user";
  for (const run of runsByOrder(page)) {
    // A row the writers sealed already opens first, so its content is written once more, not its skeleton.
    const opened = yield* Effect.forEach(run.rows, (row) =>
      openMessage(keys, identityOf(row), row)
    );
    for (const row of Arr.filter(opened, writesPrompt)) {
      const message = yield* Effect.fromNullishOr(row.message).pipe(
        Effect.orDie
      );
      const saved = yield* savePrompt(ctx, owner, {
        fileIds: row.fileIds ?? [],
        message: toModelMessage(message),
        threadId,
      });
      replacements = Arr.append(replacements, {
        next: saved.messageId,
        previous: row._id,
      });
    }
    const rest = Arr.filter(opened, (row) => !writesPrompt(row));
    if (rest.length === 0) {
      continue;
    }
    const plain = Arr.map(rest, (row) => parse(vMessageWithMetadata, row));
    const written = yield* Effect.promise(() =>
      saveMessages(ctx, components.nina, {
        ...(run.agentName === undefined ? {} : { agentName: run.agentName }),
        messages: Arr.map(plain, (row) => row.message),
        metadata: Arr.map(plain, (row) => Struct.omit(row, ["message"])),
        order: run.order,
        threadId,
      })
    );
    replacements = Arr.appendAll(
      replacements,
      Arr.map(Arr.zip(rest, written.messages), ([previous, next]) => ({
        next: next._id,
        previous: previous._id,
      }))
    );
  }
  for (const replacement of replacements) {
    yield* Effect.promise(() => repointTurns(ctx, replacement));
  }
  return replacements;
});

/**
 * Seals every row of a thread in place, as a settled turn does (ADR 0024). Each
 * order is deleted and written back sealed, at the same order and steps, through
 * the Agent's own writer. A learner's prompt keeps its order and step, but its
 * copy has a new id, so the turns that name it are pointed at the copy. Returns
 * each replaced row with the id of its copy.
 */
const sealThreadRows = Effect.fn("test.nina.seal.thread")(function* (
  threadId: string,
  owner: LearnerId
) {
  const ctx = yield* MutationCtx;
  const keys = yield* ensureLearnerKeys(owner);
  const { page } = yield* Effect.promise(() =>
    ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
      order: "asc",
      paginationOpts: { cursor: null, numItems: WHOLE_THREAD },
      threadId,
    })
  );
  yield* Effect.promise(() =>
    ctx.runMutation(components.nina.messages.deleteByIds, {
      messageIds: Arr.map(page, (row) => row._id),
    })
  );
  let replacements: readonly Replacement[] = [];
  for (const run of runsByOrder(page)) {
    // A row the writers sealed already opens first, so its content is sealed once more, not its skeleton.
    const sealed = yield* Effect.forEach(run.rows, (row) =>
      Effect.gen(function* () {
        const opened = yield* openMessage(keys, identityOf(row), row);
        return yield* sealMessage(
          keys,
          identityOf(row),
          parse(vMessageWithMetadata, opened)
        );
      })
    );
    const written = yield* Effect.promise(() =>
      saveMessages(ctx, components.nina, {
        ...(run.agentName === undefined ? {} : { agentName: run.agentName }),
        messages: Arr.map(sealed, (row) => row.message),
        metadata: Arr.map(sealed, (row) => Struct.omit(row, ["message"])),
        order: run.order,
        threadId,
      })
    );
    replacements = Arr.appendAll(
      replacements,
      Arr.map(Arr.zip(run.rows, written.messages), ([previous, next]) => ({
        next: next._id,
        previous: previous._id,
      }))
    );
  }
  for (const replacement of replacements) {
    yield* Effect.promise(() => repointTurns(ctx, replacement));
  }
  return replacements;
});

/**
 * Seals every row of a thread in place, in a mutation of the test deployment, and
 * returns the replaced rows (`sealThreadRows`).
 */
export function sealThreadIn(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  threadId: string,
  owner: LearnerId
) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      sealThreadRows(threadId, owner).pipe(
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/**
 * Writes a thread's learner rows through the writers, in a mutation of the test
 * deployment: each learner's row is saved by `savePrompt`, so it is sealed as
 * `turns.start` seals it, and every other row is written plain. Returns the
 * replaced rows (`rewriteThreadRows`).
 */
export function writtenThreadIn(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  threadId: string,
  owner: LearnerId
) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      rewriteThreadRows(threadId, owner, "writer").pipe(
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/**
 * Writes a thread's rows plain, in a mutation of the test deployment, as chats were
 * kept before sealing. Every sealed row opens first. Returns the replaced rows
 * (`rewriteThreadRows`).
 */
export function plainThreadIn(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  threadId: string,
  owner: LearnerId
) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      rewriteThreadRows(threadId, owner, "plain").pipe(
        Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
      )
    )
  );
}

/** The fields that a row changes when a sealed copy of it replaces it: its id and creation time. */
const ROW_IDENTITY_FIELDS = HashSet.make("_creationTime", "_id", "id");

/**
 * Whether a field is an empty list of files. The writers store one for a message
 * that has no files, while a fixture row holds none, so the two read the same.
 */
const isNoFiles = (key: string, value: unknown) =>
  key === "fileIds" && Arr.isArray(value) && value.length === 0;

/**
 * A read value without the ids and creation times of its rows, which a sealed
 * copy changes, and without an empty list of files (`isNoFiles`). Every other field
 * of a read must stay the same.
 */
export function withoutRowIds(value: unknown): unknown {
  if (Arr.isArray(value)) {
    return Arr.map(value, withoutRowIds);
  }
  if (Predicate.isObject(value)) {
    return Rec.map(
      Rec.filter(
        value,
        (field, key) =>
          !(HashSet.has(ROW_IDENTITY_FIELDS, key) || isNoFiles(key, field))
      ),
      withoutRowIds
    );
  }
  return value;
}
