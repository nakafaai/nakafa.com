import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { HashMap, MutableHashMap, Schema } from "effect";
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
  const postIds = posts.map((post) => post._id);
  const rowIndexByPostId = MutableHashMap.empty<
    Id<"schoolClassForumPosts">,
    number
  >();

  for (const [index, row] of rows.entries()) {
    if (row.type === "post") {
      MutableHashMap.set(rowIndexByPostId, row.post._id, index);
    }
  }

  return {
    lastPostId: getLastConversationPostId(posts),
    postIds,
    rowIndexByPostId: HashMap.fromIterable(rowIndexByPostId),
    rows,
  } satisfies ActiveTranscriptModel;
}
