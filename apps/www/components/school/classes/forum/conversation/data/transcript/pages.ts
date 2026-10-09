import { DateTime, MutableList, Schema } from "effect";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";
import {
  ForumPostSchema,
  isOptimisticForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";
import {
  type ConversationUnreadCue,
  ConversationUnreadCueSchema,
} from "@/components/school/classes/forum/conversation/data/transcript/unread";

export const ConversationRowSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal("date"), value: Schema.Finite }),
  Schema.Struct({ type: Schema.Literal("header") }),
  Schema.Struct({
    ...ConversationUnreadCueSchema.fields,
    type: Schema.Literal("unread"),
  }),
  Schema.Struct({ post: ForumPostSchema, type: Schema.Literal("post") }),
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
  const rows = MutableList.make<ConversationRow>();
  if (forum) {
    MutableList.append(rows, { type: "header" });
  }
  let previousDate: string | null = null;
  let hasInsertedUnreadSeparator = !unreadCue;
  const localZone = DateTime.zoneMakeLocal();

  for (const post of posts) {
    const currentDate = DateTime.formatIsoDate(
      DateTime.setZone(DateTime.makeUnsafe(post._creationTime), localZone)
    );

    if (currentDate !== previousDate) {
      MutableList.append(rows, { type: "date", value: post._creationTime });
      previousDate = currentDate;
    }

    if (!hasInsertedUnreadSeparator && unreadCue?.postId === post._id) {
      MutableList.append(rows, { ...unreadCue, type: "unread" });
      hasInsertedUnreadSeparator = true;
    }

    MutableList.append(rows, { type: "post", post });
  }

  return MutableList.toArray(rows);
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
