import type {
  api,
  FunctionReturnType,
} from "@repo/backend/confect/_generated/functionReferences";

export type Forum = NonNullable<
  FunctionReturnType<typeof api.classes.forums.queries.forums.getForum>
>;

export type ForumPost = FunctionReturnType<
  typeof api.classes.forums.queries.pages.getForumPosts
>[number];
