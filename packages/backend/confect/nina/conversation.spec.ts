import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import chats from "@repo/backend/confect/_generated/tables/chats";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  NinaTurnFacts,
  NinaTurnState,
} from "@repo/backend/confect/nina/turns.spec";
import { Schema, Struct } from "effect";

/** Public response facts exclude account, billing-period and private page context. */
export const NinaTurnSummary = Schema.Struct({
  ...NinaTurnFacts.fields,
  state: NinaTurnState,
}).mapFields(
  Struct.pick([
    "order",
    "state",
    "modelId",
    "credits",
    "usage",
    "tokens",
    "suggestions",
    "promptMessageId",
    "promptedAt",
  ])
);

export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "get",
    args: () => ({ chatId: Id("chats") }),
    returns: () =>
      Schema.Struct({ chat: chats.Doc, turn: Schema.NullOr(NinaTurnSummary) }),
    error: () => Schema.Union([AuthFailure, ChatAccessError]),
  }).middleware(Session)
);
