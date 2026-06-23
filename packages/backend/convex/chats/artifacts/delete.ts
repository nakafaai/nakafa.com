import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE,
  MAX_CHAT_MESSAGE_PARTS,
} from "@repo/backend/convex/chats/constants";

const MAX_CHAT_ARTIFACT_DELETE_BATCH =
  CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE * MAX_CHAT_MESSAGE_PARTS;

/** Deletes at most one supported message worth of artifact payload rows. */
export async function deleteArtifactsForMessageBatch(
  ctx: MutationCtx,
  messageId: Id<"messages">
) {
  const artifacts = await ctx.db
    .query("learningArtifacts")
    .withIndex("by_messageId_and_partOrder", (q) =>
      q.eq("messageId", messageId)
    )
    .take(MAX_CHAT_MESSAGE_PARTS + 1);

  for (const artifact of artifacts.slice(0, MAX_CHAT_MESSAGE_PARTS)) {
    await ctx.db.delete("learningArtifacts", artifact._id);
  }

  return {
    hasMore: artifacts.length > MAX_CHAT_MESSAGE_PARTS,
  };
}

/** Deletes one bounded chat worth of artifact rows before chat deletion. */
export async function deleteArtifactsForChatBatch(
  ctx: MutationCtx,
  chatId: Id<"chats">
) {
  const artifacts = await ctx.db
    .query("learningArtifacts")
    .withIndex("by_chatId_and_kind", (q) => q.eq("chatId", chatId))
    .take(MAX_CHAT_ARTIFACT_DELETE_BATCH + 1);

  for (const artifact of artifacts.slice(0, MAX_CHAT_ARTIFACT_DELETE_BATCH)) {
    await ctx.db.delete(artifact._id);
  }

  return {
    hasMore: artifacts.length > MAX_CHAT_ARTIFACT_DELETE_BATCH,
  };
}
