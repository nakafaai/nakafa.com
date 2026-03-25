import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { loadActiveClass } from "@repo/backend/convex/classes/utils";
import { requireClassAccess } from "@repo/backend/convex/lib/helpers/class";
import { ConvexError } from "convex/values";

/**
 * Load a forum by ID.
 */
export async function loadForum(
  ctx: QueryCtx | MutationCtx,
  forumId: Id<"schoolClassForums">
) {
  const forum = await ctx.db.get("schoolClassForums", forumId);

  if (!forum) {
    throw new ConvexError({
      code: "FORUM_NOT_FOUND",
      message: "Forum not found.",
    });
  }

  return forum;
}

/**
 * Load one forum and reject locked or archived threads before any write path
 * continues.
 */
async function loadOpenForum(
  ctx: QueryCtx | MutationCtx,
  forumId: Id<"schoolClassForums">
) {
  const forum = await loadForum(ctx, forumId);

  if (forum.status !== "open") {
    throw new ConvexError({
      code: "FORUM_LOCKED",
      message: "This forum is locked.",
    });
  }

  return forum;
}

/**
 * Load a forum and verify the user can access its class.
 */
export async function loadForumWithAccess(
  ctx: QueryCtx | MutationCtx,
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  const forum = await loadForum(ctx, forumId);
  const access = await requireClassAccess(
    ctx,
    forum.classId,
    forum.schoolId,
    userId
  );

  return { forum, ...access };
}

/**
 * Load an open forum in an active class and verify the user can access it.
 */
export async function loadOpenForumWithAccess(
  ctx: QueryCtx | MutationCtx,
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  const forum = await loadOpenForum(ctx, forumId);
  await loadActiveClass(ctx, forum.classId);
  const access = await requireClassAccess(
    ctx,
    forum.classId,
    forum.schoolId,
    userId
  );

  return { forum, ...access };
}

/**
 * Load any forum in an active class and verify the user can access it.
 */
export async function loadActiveForumWithAccess(
  ctx: QueryCtx | MutationCtx,
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  const forum = await loadForum(ctx, forumId);
  await loadActiveClass(ctx, forum.classId);
  const access = await requireClassAccess(
    ctx,
    forum.classId,
    forum.schoolId,
    userId
  );

  return { forum, ...access };
}
