import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";
import { forumFeedPostValidator } from "@repo/backend/confect/classes/forums/validators";
import { Schema } from "effect";

/** Forum metadata returned by the live Convex forum query. */
export type Forum = NonNullable<
  Ref.Returns<typeof refs.public.classes.forums.queries.forums.getForum>
>;

/** Transcript post row Schema: the live feed payload plus the client-only optimistic marker. */
export const ForumPostSchema = Schema.Struct({
  ...forumFeedPostValidator.fields,
  isOptimistic: Schema.optionalKey(Schema.Literal(true)),
});

/** Transcript post row, including client-only optimistic rows before Convex confirms them. */
export type ForumPost = typeof ForumPostSchema.Type;

/** Returns whether a transcript row is still a client-only optimistic post. */
export function isOptimisticForumPost(post: ForumPost) {
  return post.isOptimistic === true;
}
