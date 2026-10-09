import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Array as Arr, HashMap, Schema, Tuple } from "effect";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";
import {
  ConversationRowSchema,
  createConversationRows,
  getLastConversationPostId,
} from "@/components/school/classes/forum/conversation/data/transcript/pages";
import type { ConversationUnreadCue } from "@/components/school/classes/forum/conversation/data/transcript/unread";

export const ActiveTranscriptModelSchema = Schema.Struct({
  lastPostId: Schema.NullOr(IdSchema("schoolClassForumPosts")),
  postIds: Schema.Array(IdSchema("schoolClassForumPosts")),
  rowIndexByPostId: Schema.HashMap(
    IdSchema("schoolClassForumPosts"),
    Schema.Finite
  ),
  rows: Schema.Array(ConversationRowSchema),
});
export type ActiveTranscriptModel = typeof ActiveTranscriptModelSchema.Type;

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
  const postIds = Arr.map(posts, (post) => post._id);
  const rowIndexByPostId = HashMap.fromIterable(
    Arr.flatMap(rows, (row, index) =>
      row.type === "post" ? [Tuple.make(row.post._id, index)] : []
    )
  );

  return {
    lastPostId: getLastConversationPostId(posts),
    postIds,
    rowIndexByPostId,
    rows,
  } satisfies ActiveTranscriptModel;
}
