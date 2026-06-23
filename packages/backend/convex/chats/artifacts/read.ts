import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { requireChatAccess } from "@repo/backend/convex/lib/helpers/chat";
import { ConvexError } from "convex/values";

/**
 * Loads one visible artifact payload after checking the owning chat access.
 * The query path is bounded by artifact id and refuses duplicate durable rows.
 */
export async function loadVisibleArtifact(
  ctx: QueryCtx,
  artifactId: string,
  viewerUserId: Id<"users"> | null
) {
  const artifacts = await ctx.db
    .query("learningArtifacts")
    .withIndex("by_artifactId", (q) => q.eq("artifactId", artifactId))
    .take(2);

  if (artifacts.length === 0) {
    throw new ConvexError({
      code: "LEARNING_ARTIFACT_NOT_FOUND",
      message: "Learning artifact was not found.",
    });
  }

  if (artifacts.length > 1) {
    throw new ConvexError({
      code: "LEARNING_ARTIFACT_DUPLICATE",
      message: "Learning artifact id resolves to multiple payloads.",
    });
  }

  const artifact = artifacts[0];
  const chat = await ctx.db.get("chats", artifact.chatId);
  if (!chat) {
    throw new ConvexError({
      code: "CHAT_NOT_FOUND",
      message: "Artifact owning chat was not found.",
    });
  }

  requireChatAccess(chat.userId, viewerUserId, chat.visibility);

  return {
    artifactId: artifact.artifactId,
    description: artifact.description,
    kind: artifact.kind,
    payload: artifact.payload,
    proofAnchors: artifact.proofAnchors,
    schemaVersion: artifact.schemaVersion,
    title: artifact.title,
  };
}
