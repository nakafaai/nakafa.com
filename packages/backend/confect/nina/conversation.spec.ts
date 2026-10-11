import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import { chatViewValidator } from "@repo/backend/confect/chats/view";
import Session from "@repo/backend/confect/middleware/session.spec";
import { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import { Schema } from "effect";

export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "get",
    args: () => ({ chatId: Id("chats") }),
    returns: () =>
      Schema.Struct({
        chat: chatViewValidator,
        turn: Schema.NullOr(NinaTurnSummary),
      }),
    error: () => Schema.Union([AuthFailure, ChatAccessError]),
  }).middleware(Session)
);
