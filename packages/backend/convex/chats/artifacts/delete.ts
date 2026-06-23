import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { MAX_CHAT_MESSAGE_PARTS } from "@repo/backend/convex/chats/constants";

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
