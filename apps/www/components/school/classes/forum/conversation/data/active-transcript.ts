import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";
import {
  type ConversationRow,
  createConversationRows,
  getLastConversationPostId,
} from "@/components/school/classes/forum/conversation/data/pages";
import type { ConversationUnreadCue } from "@/components/school/classes/forum/conversation/data/unread";

export interface ActiveTranscriptModel {
  lastPostId: Id<"schoolClassForumPosts"> | null;
  postIds: Id<"schoolClassForumPosts">[];
  rowIndexByPostId: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
  rows: ConversationRow[];
}

/** Builds the current loaded transcript model from one reactive post list. */
export function createActiveTranscriptModel({
  forum,
  posts,
  unreadCue,
}: {
  forum: Forum | undefined;
  posts: ForumPost[];
  unreadCue?: ConversationUnreadCue | null;
}) {
  const rows = createConversationRows({
    forum,
    posts,
    unreadCue,
  });
  const postIds = posts.map((post) => post._id);
  const rowIndexByPostId = new Map<Id<"schoolClassForumPosts">, number>();

  for (const [index, row] of rows.entries()) {
    if (row.type === "post") {
      rowIndexByPostId.set(row.post._id, index);
    }
  }

  return {
    lastPostId: getLastConversationPostId(posts),
    postIds,
    rowIndexByPostId,
    rows,
  } satisfies ActiveTranscriptModel;
}
