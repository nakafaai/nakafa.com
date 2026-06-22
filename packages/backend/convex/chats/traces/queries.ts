import { query } from "@repo/backend/convex/_generated/server";
import { listCapabilityTraces } from "@repo/backend/convex/chats/traces/impl";
import {
  capabilityTraceRecordValidator,
  listCapabilityTracesArgs,
} from "@repo/backend/convex/chats/traces/spec";
import { v } from "convex/values";

/** Lists bounded Nina LearningCapability trace summaries for an owned chat. */
export const list = query({
  args: listCapabilityTracesArgs,
  returns: v.array(capabilityTraceRecordValidator),
  handler: async (ctx, args) => await listCapabilityTraces(ctx, args),
});
