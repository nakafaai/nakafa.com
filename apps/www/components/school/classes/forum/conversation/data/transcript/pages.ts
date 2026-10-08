import { Schema } from "effect";
import {
  type Forum,
  type ForumPost,
  ForumPostSchema,
  isOptimisticForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";
import {
  type ConversationUnreadCue,
  ConversationUnreadCueSchema,
} from "@/components/school/classes/forum/conversation/data/transcript/unread";

const ConversationDateRowSchema = Schema.Struct({
  type: Schema.Literal("date"),
  value: Schema.Finite,
});

const ConversationHeaderRowSchema = Schema.Struct({
  type: Schema.Literal("header"),
});

const ConversationUnreadRowSchema = Schema.Struct({
  ...ConversationUnreadCueSchema.fields,
  type: Schema.Literal("unread"),
});

const ConversationPostRowSchema = Schema.Struct({
  post: ForumPostSchema,
  type: Schema.Literal("post"),
});

const ConversationRowSchema = Schema.Union([
  ConversationDateRowSchema,
  ConversationHeaderRowSchema,
  ConversationUnreadRowSchema,
  ConversationPostRowSchema,
]);

export type ConversationRow = typeof ConversationRowSchema.Type;

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

/** Returns the final confirmed post id in one ordered transcript list. */
export function getLastConversationPostId(posts: ForumPost[]) {
  for (let index = posts.length - 1; index >= 0; index -= 1) {
    const post = posts[index];

    if (!isOptimisticForumPost(post)) {
      return post._id;
    }
  }

  return null;
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
