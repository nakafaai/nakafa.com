import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { enrichForumPosts } from "@repo/backend/confect/classes/forums/posts";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";
export const getForumReadState = Effect.fn(
  "classes.forums.transcript.getForumReadState"
)(function* (
  ctx: QueryCtx,
  forumId: Id<"schoolClassForums">,
  currentUserId: Id<"users">
) {
  return yield* DatabaseReader.make(databaseSchema, ctx.db)
    .table("schoolClassForumReadStates")
    .get("by_forumId_and_userId", forumId, currentUserId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/**
 * Enriches the live transcript once per query, keeping unread state
 * server-derived instead of rebuilding that logic on the client.
 *
 * References:
 * - https://docs.convex.dev/understanding/best-practices/
 * - https://docs.convex.dev/database/pagination
 */
export const createForumFeedPosts = Effect.fn(
  "classes.forums.transcript.createForumFeedPosts"
)(function* (
  ctx: QueryCtx,
  {
    currentUserId,
    forumId,
    posts,
  }: {
    currentUserId: Id<"users">;
    forumId: Id<"schoolClassForums">;
    posts: Doc<"schoolClassForumPosts">[];
  }
) {
  const [enrichedPosts, readState] = yield* Effect.all([
    enrichForumPosts(ctx, posts, currentUserId),
    getForumReadState(ctx, forumId, currentUserId),
  ]);
  const lastReadSequence = readState?.lastReadSequence ?? 0;
  return enrichedPosts.map((post) => ({
    ...post,
    isUnread:
      post.createdBy !== currentUserId && post.sequence > lastReadSequence,
  }));
});
