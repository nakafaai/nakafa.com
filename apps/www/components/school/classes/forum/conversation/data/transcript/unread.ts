import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Schema } from "effect";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

export const ConversationUnreadCueSchema = Schema.Struct({
  count: Schema.Finite,
  postId: IdSchema("schoolClassForumPosts"),
  status: Schema.Literals(["history", "new"]),
});
export type ConversationUnreadCue = typeof ConversationUnreadCueSchema.Type;

type InitialConversationUnreadCue = Omit<ConversationUnreadCue, "status">;

/** Finds the initial unread backlog anchor from the current ascending posts. */
export function getInitialConversationUnreadCue(posts: ForumPost[]) {
  let count = 0;
  let postId: Id<"schoolClassForumPosts"> | null = null;

  for (const post of posts) {
    if (!post.isUnread) {
      continue;
    }

    postId ??= post._id;
    count += 1;
  }

  if (!(postId && count > 0)) {
    return null;
  }

  return {
    count,
    postId,
  } satisfies InitialConversationUnreadCue;
}
