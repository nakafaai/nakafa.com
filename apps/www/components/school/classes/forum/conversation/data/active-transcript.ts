import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMemo } from "react";
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
  lastRowIndex: number | null;
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
    lastRowIndex: rows.length > 0 ? rows.length - 1 : null,
    postIds,
    rowIndexByPostId,
    rows,
  } satisfies ActiveTranscriptModel;
}

/** Memoized boundary between transcript data and the render/scroll engine. */
export function useActiveTranscriptModel(input: {
  forum: Forum | undefined;
  posts: ForumPost[];
  unreadCue?: ConversationUnreadCue | null;
}) {
  const { forum, posts, unreadCue } = input;

  return useMemo(
    () =>
      createActiveTranscriptModel({
        forum,
        posts,
        unreadCue,
      }),
    [forum, posts, unreadCue]
  );
}
