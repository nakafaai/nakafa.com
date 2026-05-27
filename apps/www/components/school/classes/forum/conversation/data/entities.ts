import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";

export type Forum = Ref.Returns<
  typeof refs.public.classes.forums.queries.forums.getForum
>;

export type ForumPost = Ref.Returns<
  typeof refs.public.classes.forums.queries.pages.getForumPosts
>[number];
