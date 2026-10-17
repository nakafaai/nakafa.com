import { FunctionSpec, GroupSpec, PaginationOptions } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AgentId } from "@repo/backend/confect/nina/contract/message";
import { VaultError } from "@repo/backend/confect/vault/schema";
import { Schema } from "effect";

/** The component could not list or read the messages. The rows of a read never reach the caller. */
export class SealedReadError extends Schema.TaggedError<SealedReadError>()(
  "SealedReadError",
  {}
) {}

/**
 * The key ring cannot be read, so no turn can be sealed now. The fault is broad and
 * blames no turn, so the drain stops its run at once (ADR 0024).
 */
export class SealUnavailable extends Schema.TaggedError<SealUnavailable>()(
  "SealUnavailable",
  {}
) {}

/** The message statuses the component's list filters by. */
const ListedStatus = Schema.Literals(["failed", "pending", "success"]);

/** What one seal cost: the bytes its reads and writes counted (ADR 0024). */
const SealCost = Schema.Struct({ bytes: Schema.Finite });

/** One page of the settled turns that the sweep may still seal, oldest first. */
const SealCandidates = Schema.Struct({
  continueCursor: Schema.String,
  ids: Schema.Array(Id("ninaTurns")),
  isDone: Schema.Boolean,
});

/** What a failed seal left on its turn: the failures so far, and whether the sweep now holds it. */
const SealFailure = Schema.Struct({
  attempts: Schema.Int,
  held: Schema.Boolean,
});

/** The arguments of one read of a thread's messages, newest first, with the owner whose key opens them. */
export const ThreadArgs = Schema.Struct({
  excludeToolMessages: Schema.optionalKey(Schema.Boolean),
  owner: Id("users"),
  paginationOpts: PaginationOptions.PaginationOptions,
  statuses: Schema.optionalKey(Schema.mutable(Schema.Array(ListedStatus))),
  threadId: AgentId,
  upToAndIncludingMessageId: Schema.optionalKey(AgentId),
});

/**
 * One page of a thread's messages, opened for its owner. The rows are the
 * Agent's own message documents, so a caller validates each row with the
 * Agent's validator before it reads one (`sealed/action.ts`).
 */
const ThreadPage = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(Schema.Unknown),
});

export default GroupSpec.make()
  // A page of a thread's messages, newest first, opened for `owner`. An action
  // reads a page through it, because only a query or a mutation reads keys.
  .addFunction(
    FunctionSpec.internalQuery({
      name: "thread",
      args: () => ThreadArgs.fields,
      returns: () => ThreadPage,
      error: () => Schema.Union([SealedReadError, VaultError]),
    })
  )
  // One message of a thread, opened for `owner`, or null when it is gone.
  .addFunction(
    FunctionSpec.internalQuery({
      name: "message",
      args: () => ({ messageId: AgentId, owner: Id("users") }),
      returns: () => Schema.NullOr(Schema.Unknown),
      error: () => Schema.Union([SealedReadError, VaultError]),
    })
  )
  // Seals the rows of one settled turn (ADR 0024). Settlement schedules it, and the drain calls it.
  // It fails with `SealUnavailable` only when the key ring cannot be read.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "seal",
      args: () => ({ turnId: Id("ninaTurns") }),
      returns: () => SealCost,
      error: () => SealUnavailable,
    })
  )
  // Seals the settled turns that still hold plain rows, oldest first, within a byte
  // budget. The sweep schedules it once a run (`sealed/drain.ts`).
  .addFunction(
    FunctionSpec.internalAction({
      name: "drain",
      args: () => ({ budget: Schema.Finite }),
      returns: () => Schema.Null,
    })
  )
  // One page of the turns the drain may still seal, oldest first.
  .addFunction(
    FunctionSpec.internalQuery({
      name: "candidates",
      args: () => ({
        cursor: Schema.NullOr(Schema.String),
        numItems: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
      }),
      returns: () => SealCandidates,
    })
  )
  // Counts one failed seal on its turn, and holds the turn once it has failed `SEAL_TRIES` times.
  .addFunction(
    FunctionSpec.internalMutation({
      name: "recordFailure",
      args: () => ({ turnId: Id("ninaTurns") }),
      returns: () => Schema.NullOr(SealFailure),
    })
  );
