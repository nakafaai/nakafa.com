import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type Forum = NonNullable<
  FunctionReturnType<typeof api.classes.forums.queries.forums.getForum>
>;

export type ForumPost = FunctionReturnType<
  typeof api.classes.forums.queries.pages.getForumPosts
>[number];
