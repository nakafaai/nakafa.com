import { FunctionSpec, GroupSpec, PaginationOptions } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** Operator-owned cutover only. Retire after both deployments have zero old rows. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "list",
      args: () => ({ paginationOpts: PaginationOptions.PaginationOptions }),
      returns: () =>
        Schema.Struct({
          chatIds: Schema.Array(Id("chats")),
          cursor: Schema.String,
          done: Schema.Boolean,
        }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "convert",
      args: () => ({ chatId: Id("chats") }),
      returns: () =>
        Schema.Struct({
          threadId: Schema.String,
          messages: Schema.Finite,
          turns: Schema.Finite,
        }),
    })
  );
