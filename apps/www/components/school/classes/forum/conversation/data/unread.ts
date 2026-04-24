import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

export interface ConversationUnreadCue {
  count: number;
  postId: Id<"schoolClassForumPosts">;
  status: "history" | "new";
}

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
