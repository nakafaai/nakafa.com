import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import { capabilityTraceRecordValidator } from "@repo/backend/confect/chats/traces/record";
import { listCapabilityTracesArgs } from "@repo/backend/confect/chats/traces/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
/** Lists bounded Nina LearningCapability trace summaries for an owned chat. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "list",
    args: () => listCapabilityTracesArgs,
    returns: () => Schema.Array(capabilityTraceRecordValidator),
    error: () => Schema.Union([AuthFailure, ChatAccessError]),
  }).middleware(Session)
);
