import { FunctionSpec, GroupSpec, PaginationOptions } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { MessagePage, StreamRequest } from "@repo/backend/confect/nina/schema";
import { Schema } from "effect";

export class NinaReadError extends Schema.TaggedError<NinaReadError>()(
  "NinaReadError",
  { message: Schema.String }
) {}

export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "list",
    args: () => ({
      chatId: Id("chats"),
      threadId: Schema.String,
      paginationOpts: PaginationOptions.PaginationOptions,
      streamArgs: Schema.optionalKey(StreamRequest),
    }),
    returns: () => MessagePage,
    error: () => Schema.Union([AuthFailure, ChatAccessError, NinaReadError]),
  }).middleware(Session)
);
