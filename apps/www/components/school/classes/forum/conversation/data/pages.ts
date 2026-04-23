import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";
import type { ConversationUnreadCue } from "@/components/school/classes/forum/conversation/data/unread";

export const FORUM_BOTTOM_THRESHOLD = 12;

export type ConversationRow =
  | { type: "date"; value: number }
  | { type: "header" }
  | (ConversationUnreadCue & { type: "unread" })
  | { post: ForumPost; type: "post" };

/**
 * Build transcript rows from one ascending post list.
 *
 * References:
 * - https://react.dev/learn/conditional-rendering
 * - https://docs.convex.dev/understanding/best-practices/
 */
export function createConversationRows({
  forum,
  posts,
  unreadCue,
}: {
  forum: Forum | undefined;
  posts: ForumPost[];
  unreadCue?: ConversationUnreadCue | null;
}) {
  const rows: ConversationRow[] = forum ? [{ type: "header" }] : [];
  let previousDate: string | null = null;
  let hasInsertedUnreadSeparator = !unreadCue;

  for (const post of posts) {
    const currentDate = new Date(post._creationTime).toDateString();

    if (currentDate !== previousDate) {
      rows.push({ type: "date", value: post._creationTime });
      previousDate = currentDate;
    }

    if (!hasInsertedUnreadSeparator && unreadCue?.postId === post._id) {
      rows.push({ ...unreadCue, type: "unread" });
      hasInsertedUnreadSeparator = true;
    }

    rows.push({ type: "post", post });
  }

  return rows;
}

/** Returns the final post id in one ordered transcript list. */
export function getLastConversationPostId(posts: ForumPost[]) {
  return posts.at(-1)?._id ?? null;
}

/** Returns the stable React key for one rendered conversation row. */
export function getConversationRowKey(
  row: ConversationRow,
  forumId: Forum["_id"] | undefined
) {
  if (row.type === "header") {
    return forumId ?? "header";
  }

  if (row.type === "date") {
    return `date:${row.value}`;
  }

  if (row.type === "unread") {
    return `unread:${row.postId}`;
  }

  return row.post._id;
}
