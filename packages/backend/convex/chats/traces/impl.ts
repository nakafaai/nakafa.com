import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { verifyChatOwnership } from "@repo/backend/convex/chats/helpers";
import {
  CAPABILITY_TRACE_BATCH_SIZE,
  CAPABILITY_TRACE_RETENTION_MS,
  type CapabilityTraceInput,
  type DeleteExpiredCapabilityTracesArgs,
  type ListCapabilityTracesArgs,
} from "@repo/backend/convex/chats/traces/spec";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { ConvexError } from "convex/values";

const defaultTraceReadLimit = 20;
const maxTraceReadLimit = 100;

/** Resolves the authenticated owner for one trace operation. */
async function requireTraceOwner(ctx: MutationCtx | QueryCtx) {
  const user = await getOptionalAppUser(ctx);

  if (!user) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Sign in is required to read or write Nina capability traces.",
    });
  }

  return user.appUser;
}

/** Persists one bounded operational trace for a Nina LearningCapability call. */
export async function saveCapabilityTrace(
  ctx: MutationCtx,
  chatId: Doc<"chats">["_id"],
  trace: CapabilityTraceInput
) {
  const user = await requireTraceOwner(ctx);

  await verifyChatOwnership(ctx, chatId, user._id);

  return await ctx.db.insert("ninaCapabilityTraces", {
    ...trace,
    chatId,
    expiresAt: trace.endedAt + CAPABILITY_TRACE_RETENTION_MS,
    status: trace.evidence.status,
    userId: user._id,
  });
}

/** Lists recent trace summaries for one owned chat using bounded indexed reads. */
export async function listCapabilityTraces(
  ctx: QueryCtx,
  args: ListCapabilityTracesArgs
) {
  const user = await requireTraceOwner(ctx);
  const limit = Math.min(
    args.limit ?? defaultTraceReadLimit,
    maxTraceReadLimit
  );

  await verifyChatOwnership(ctx, args.chatId, user._id);

  const responseMessageIdentifier = args.responseMessageIdentifier;

  if (responseMessageIdentifier) {
    return await ctx.db
      .query("ninaCapabilityTraces")
      .withIndex("by_chatId_and_responseMessageIdentifier_and_startedAt", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("responseMessageIdentifier", responseMessageIdentifier)
      )
      .order("desc")
      .take(limit);
  }

  return await ctx.db
    .query("ninaCapabilityTraces")
    .withIndex("by_chatId_and_startedAt", (q) => q.eq("chatId", args.chatId))
    .order("desc")
    .take(limit);
}

/** Deletes one bounded page of expired derived trace summaries. */
export async function deleteExpiredCapabilityTraces(
  ctx: MutationCtx,
  args: DeleteExpiredCapabilityTracesArgs
) {
  const expired = await ctx.db
    .query("ninaCapabilityTraces")
    .withIndex("by_expiresAt", (q) => q.lte("expiresAt", args.now))
    .take(CAPABILITY_TRACE_BATCH_SIZE + 1);
  const page = expired.slice(0, CAPABILITY_TRACE_BATCH_SIZE);

  for (const trace of page) {
    await ctx.db.delete(trace._id);
  }

  return {
    deleted: page.length,
    hasMore: expired.length > CAPABILITY_TRACE_BATCH_SIZE,
  };
}
