import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import {
  capabilityTraceInputValidator,
  deleteExpiredCapabilityTracesArgs,
  deleteExpiredCapabilityTracesResultValidator,
} from "@repo/backend/confect/chats/traces/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
/** Saves one owner-scoped Nina LearningCapability trace summary. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "save",
      args: () => ({
        chatId: IdSchema("chats"),
        trace: capabilityTraceInputValidator,
      }),
      returns: () => IdSchema("ninaCapabilityTraces"),
      error: () => Schema.Union([AuthFailure, ChatAccessError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteExpiredBatch",
      args: () => deleteExpiredCapabilityTracesArgs,
      returns: () => deleteExpiredCapabilityTracesResultValidator,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweepExpired",
      args: () => ({}),
      returns: () => deleteExpiredCapabilityTracesResultValidator,
    }).middleware(Atomic)
  );
