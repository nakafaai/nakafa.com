import { RegisteredConvexFunction } from "@confect/server";
import { saveMessages } from "@convex-dev/agent";
import type { MessageDoc } from "@convex-dev/agent/validators";
import { vMessageWithMetadata } from "@convex-dev/agent/validators";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { identityOf, sealMessage } from "@repo/backend/confect/nina/sealed";
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
    const sealed = yield* Effect.forEach(run.rows, (row) =>
      sealMessage(keys, identityOf(row), parse(vMessageWithMetadata, row))
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

/** The fields that a row changes when a sealed copy of it replaces it: its id and creation time. */
const ROW_IDENTITY_FIELDS = HashSet.make("_creationTime", "_id", "id");

/**
 * A read value without the ids and creation times of its rows, which a sealed
 * copy changes. Every other field of a read must stay the same.
 */
export function withoutRowIds(value: unknown): unknown {
  if (Arr.isArray(value)) {
    return Arr.map(value, withoutRowIds);
  }
  if (Predicate.isObject(value)) {
    return Rec.map(
      Rec.filter(value, (_, key) => !HashSet.has(ROW_IDENTITY_FIELDS, key)),
      withoutRowIds
    );
  }
  return value;
}
