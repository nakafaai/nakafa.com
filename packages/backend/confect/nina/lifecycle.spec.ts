import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import turns from "@repo/backend/confect/_generated/tables/ninaTurns";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { NinaFailureReason } from "@repo/backend/confect/nina/contract/turn";
import { NinaCreditError } from "@repo/backend/confect/nina/credits/schema";
import { NinaTurnError } from "@repo/backend/confect/nina/turns.spec";
import { Schema } from "effect";

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "presentation",
      args: () => ({ turnId: Id("ninaTurns") }),
      returns: () =>
        Schema.NullOr(
          turns.Doc.pipe(Schema.refine((turn) => turn.phase === "settled"))
        ),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "claim",
      args: () => ({ turnId: Id("ninaTurns") }),
      returns: () =>
        Schema.NullOr(
          turns.Doc.pipe(Schema.refine((turn) => turn.phase === "active"))
        ),
      error: () => Schema.Union([NinaCreditError, NinaTurnError]),
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
      error: () => Schema.Union([NinaCreditError, NinaTurnError]),
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
          NinaCreditError,
          NinaTurnError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
