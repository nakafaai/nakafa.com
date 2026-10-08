import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, HashMap } from "effect";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";
import {
  createConversationRows,
  getLastConversationPostId,
} from "@/components/school/classes/forum/conversation/data/transcript/pages";
import type { ConversationUnreadCue } from "@/components/school/classes/forum/conversation/data/transcript/unread";

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
    ...(unreadCue === undefined ? {} : { unreadCue }),
  });
  const postIds = posts.map((post) => post._id);
  const rowIndexEntries = Arr.flatMap(
    rows,
    (row, index): [Id<"schoolClassForumPosts">, number][] =>
      row.type === "post" ? [[row.post._id, index]] : []
  );
  const rowIndexByPostId = HashMap.fromIterable(rowIndexEntries);

  return {
    lastPostId: getLastConversationPostId(posts),
    postIds,
    rowIndexByPostId,
    rows,
  };
}

/** The loaded transcript model the viewport reads, derived from its builder. */
export type ActiveTranscriptModel = ReturnType<
  typeof createActiveTranscriptModel
>;
