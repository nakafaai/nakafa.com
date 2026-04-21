import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { PostAttachment } from "@repo/backend/convex/classes/forums/utils/posts";
import type { UserData } from "@repo/backend/convex/lib/helpers/user";

export interface ReactionWithUsers {
  count: number;
  emoji: string;
  reactors: string[];
}

export interface ForumPost extends Doc<"schoolClassForumPosts"> {
  attachments: PostAttachment[];
  isUnread?: boolean;
  myReactions: string[];
  reactionUsers: ReactionWithUsers[];
  replyToUser: UserData | null;
  user: UserData | null;
}

export interface ReplyTo {
  postId: Id<"schoolClassForumPosts">;
  userName: string;
}

export type ForumConversationView =
  | {
      kind: "bottom";
    }
  | {
      kind: "post";
      offset: number;
      postId: Id<"schoolClassForumPosts">;
    };
