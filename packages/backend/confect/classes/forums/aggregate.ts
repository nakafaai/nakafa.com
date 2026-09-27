import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";
import type { DataModel, Id } from "@repo/backend/convex/_generated/dataModel";

/**
 * Aggregate forum posts by forum-local sequence so queries can count unread
 * posts after one read boundary in logarithmic time.
 */
export const forumPostsBySequence = new TableAggregate<{
  Namespace: Id<"schoolClassForums">;
  Key: number;
  DataModel: DataModel;
  TableName: "schoolClassForumPosts";
}>(components.forumPostsBySequence, {
  namespace: (post) => post.forumId,
  sortKey: (post) => post.sequence,
});

/**
 * Aggregate forum posts by forum and author so unread counts can subtract the
 * viewer's own posts without per-forum scans.
 */
export const forumPostsByAuthorSequence = new TableAggregate<{
  Namespace: [Id<"schoolClassForums">, Id<"users">];
  Key: number;
  DataModel: DataModel;
  TableName: "schoolClassForumPosts";
}>(components.forumPostsByAuthorSequence, {
  namespace: (post) => [post.forumId, post.createdBy],
  sortKey: (post) => post.sequence,
});
