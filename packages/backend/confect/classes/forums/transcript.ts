import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { enrichForumPosts } from "@repo/backend/confect/classes/forums/posts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect } from "effect";
export const getForumReadState = Effect.fn(
  "classes.forums.transcript.getForumReadState"
)(function* (forumId: Id<"schoolClassForums">, currentUserId: Id<"users">) {
  return yield* (yield* DatabaseReader)
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
)(function* ({
  currentUserId,
  forumId,
  posts,
}: {
  currentUserId: Id<"users">;
  forumId: Id<"schoolClassForums">;
  posts: Docs["schoolClassForumPosts"][];
}) {
  const [enrichedPosts, readState] = yield* Effect.all([
    enrichForumPosts(posts, currentUserId),
    getForumReadState(forumId, currentUserId),
  ]);
  const lastReadSequence = readState?.lastReadSequence ?? 0;
  return Arr.map(enrichedPosts, (post) => ({
    ...post,
    isUnread:
      post.createdBy !== currentUserId && post.sequence > lastReadSequence,
  }));
});
