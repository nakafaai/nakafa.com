import type { Id } from "@repo/backend/confect/_generated/id";

/**
 * Whether a learner may read an author's posts, and so like one. Posts show
 * where the profile shows, and a profile opens only for its owner until a
 * stored age makes one public (K15, read in `apps/www/lib/profile/server.ts`).
 * So today the author alone reads them. The public profile step changes this
 * rule and nothing else.
 */
export function mayReadPosts(
  viewerId: Id<"users"> | null,
  authorId: Id<"users">
): boolean {
  return viewerId === authorId;
}
