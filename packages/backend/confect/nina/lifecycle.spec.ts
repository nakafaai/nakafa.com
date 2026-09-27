import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import turns from "@repo/backend/confect/_generated/tables/ninaTurns";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import { ChatTurnError } from "@repo/backend/confect/chats/turns/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  NinaFailureReason,
  NinaTurnError,
} from "@repo/backend/confect/nina/turns.spec";
import { Schema } from "effect";

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "claim",
      args: () => ({ turnId: Id("ninaTurns") }),
      returns: () =>
        Schema.NullOr(
          turns.Doc.pipe(Schema.refine((turn) => turn.phase === "active"))
        ),
      error: () => Schema.Union([ChatTurnError, NinaTurnError]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "recover",
      args: () => ({
        turnId: Id("ninaTurns"),
        failure: Schema.optionalKey(NinaFailureReason),
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([ChatTurnError, NinaTurnError]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "cancel",
      args: () => ({ chatId: Id("chats") }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          AuthFailure,
          ChatAccessError,
          ChatTurnError,
          NinaTurnError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
