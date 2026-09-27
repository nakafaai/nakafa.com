import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { modelIdValueValidator } from "@repo/backend/confect/chats/schema";
import { ChatTurnError } from "@repo/backend/confect/chats/turns/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/** Admits one authenticated turn before the HTTP adapter starts provider work. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reserve",
      args: () => ({
        modelId: modelIdValueValidator,
      }),
      returns: () => IdSchema("chatTurns"),
      error: () => Schema.Union([AuthFailure, ChatTurnError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "release",
      args: () => ({
        turnId: IdSchema("chatTurns"),
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, ChatTurnError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "expire",
      args: () => ({
        turnId: IdSchema("chatTurns"),
      }),
      returns: () => Schema.Null,
      error: () => ChatTurnError,
    })
  );
