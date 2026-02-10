/**
 * Chat access control helpers.
 *
 * Enforce chat visibility and ownership rules.
 */
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ConvexError } from "convex/values";

/**
 * Require chat access or throw.
 * Throws FORBIDDEN if user doesn't own a private chat.
 */
export function requireChatAccess(
  chatUserId: Id<"users">,
  currentUserId: Id<"users">,
  visibility: "public" | "private"
) {
  if (visibility === "private" && chatUserId !== currentUserId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this private chat.",
    });
  }
}
