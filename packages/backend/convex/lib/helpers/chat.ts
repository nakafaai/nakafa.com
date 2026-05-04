/**
 * Chat access control helpers.
 *
 * Enforce chat visibility and ownership rules.
 */

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ConvexError } from "convex/values";

/**
 * Require chat access or throw.
 * Public chats are readable by anyone.
 * Private chats are readable only by the owner.
 */
export function requireChatAccess(
  chatUserId: Id<"users">,
  currentUserId: Id<"users"> | null | undefined,
  visibility: "public" | "private"
) {
  if (visibility === "private" && chatUserId !== currentUserId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this private chat.",
    });
  }
}
