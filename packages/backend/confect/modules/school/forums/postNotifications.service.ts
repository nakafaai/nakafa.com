import { createNotification } from "@repo/backend/confect/modules/notifications/notifications.service";
import type {
  SchoolClassForumPosts,
  SchoolClassForums,
} from "@repo/backend/confect/modules/school/classes.tables";
import { truncateText } from "@repo/backend/confect/modules/school/forums/posts.service";
import { Effect, type Schema } from "effect";

type ForumDoc = Schema.Schema.Type<typeof SchoolClassForums.Doc>;
type ForumPostDoc = Schema.Schema.Type<typeof SchoolClassForumPosts.Doc>;

/** Sends reply and mention notifications for a newly inserted forum post. */
export const notifyForumPostParticipants = Effect.fn(
  "school.forums.notifyForumPostParticipants"
)(function* (args: { forum: ForumDoc; post: ForumPostDoc }) {
  const previewBody = truncateText({ text: args.post.body });

  if (
    args.post.parentId &&
    args.post.replyToUserId &&
    args.post.replyToUserId !== args.post.createdBy
  ) {
    yield* createNotification({
      actorId: args.post.createdBy,
      entityId: args.post._id,
      entityType: "schoolClassForumPosts",
      previewBody,
      previewTitle: args.forum.title,
      recipientId: args.post.replyToUserId,
      type: "post_reply",
    });
  }

  for (const mentionedUserId of args.post.mentions) {
    if (
      mentionedUserId === args.post.createdBy ||
      mentionedUserId === args.post.replyToUserId
    ) {
      continue;
    }

    yield* createNotification({
      actorId: args.post.createdBy,
      entityId: args.post._id,
      entityType: "schoolClassForumPosts",
      previewBody,
      previewTitle: args.forum.title,
      recipientId: mentionedUserId,
      type: "post_mention",
    });
  }

  return null;
});
