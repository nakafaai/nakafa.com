import {
  deleteExpiredCapabilityTraces,
  saveCapabilityTrace,
} from "@repo/backend/convex/chats/traces/impl";
import {
  capabilityTraceInputValidator,
  deleteExpiredCapabilityTracesArgs,
  deleteExpiredCapabilityTracesResultValidator,
} from "@repo/backend/convex/chats/traces/spec";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

/** Saves one owner-scoped Nina LearningCapability trace summary. */
export const save = mutation({
  args: {
    chatId: v.id("chats"),
    trace: capabilityTraceInputValidator,
  },
  returns: v.id("ninaCapabilityTraces"),
  handler: async (ctx, args) =>
    await saveCapabilityTrace(ctx, args.chatId, args.trace),
});

/** Deletes a bounded page of expired derived trace summaries. */
export const deleteExpiredBatch = internalMutation({
  args: deleteExpiredCapabilityTracesArgs,
  returns: deleteExpiredCapabilityTracesResultValidator,
  handler: async (ctx, args) => await deleteExpiredCapabilityTraces(ctx, args),
});

/** Starts the scheduled retention sweep for expired capability trace summaries. */
export const sweepExpired = internalMutation({
  args: {},
  returns: deleteExpiredCapabilityTracesResultValidator,
  handler: async (ctx) =>
    await deleteExpiredCapabilityTraces(ctx, { now: Date.now() }),
});
