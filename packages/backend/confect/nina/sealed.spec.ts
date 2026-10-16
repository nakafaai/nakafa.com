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

/** The message statuses the component's list filters by. */
const ListedStatus = Schema.Literals(["failed", "pending", "success"]);

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
  );
