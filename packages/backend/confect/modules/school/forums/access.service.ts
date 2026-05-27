import type { Id } from "@repo/backend/confect/_generated/dataModel";
import type {
  MutationCtx as ConvexMutationCtx,
  QueryCtx as ConvexQueryCtx,
} from "@repo/backend/confect/_generated/services";
import {
  loadActiveClass,
  requireClassAccess,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import { Effect } from "effect";

type DatabaseCtx = ConvexMutationCtx | ConvexQueryCtx;

/** Loads a forum row by id. */
export const loadForum = Effect.fn("school.forums.loadForum")(function* (
  ctx: DatabaseCtx,
  forumId: Id<"schoolClassForums">
) {
  const forum = yield* Effect.promise(() => ctx.db.get(forumId));

  if (!forum) {
    return yield* Effect.fail(
      new ClassActionError({ message: "Forum not found." })
    );
  }

  return forum;
});

/** Loads a forum that accepts new posts. */
export const loadOpenForum = Effect.fn("school.forums.loadOpenForum")(
  function* (ctx: DatabaseCtx, forumId: Id<"schoolClassForums">) {
    const forum = yield* loadForum(ctx, forumId);

    if (forum.status !== "open") {
      return yield* Effect.fail(
        new ClassActionError({ message: "This forum is locked." })
      );
    }

    return forum;
  }
);

/** Loads a forum and verifies class access. */
export const loadForumWithAccess = Effect.fn(
  "school.forums.loadForumWithAccess"
)(function* (
  ctx: DatabaseCtx,
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  const forum = yield* loadForum(ctx, forumId);
  const access = yield* requireClassAccess(
    ctx,
    forum.classId,
    forum.schoolId,
    userId
  );

  return { ...access, forum };
});

/** Loads an open forum whose class is still active and verifies access. */
export const loadOpenForumWithAccess = Effect.fn(
  "school.forums.loadOpenForumWithAccess"
)(function* (
  ctx: DatabaseCtx,
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  const forum = yield* loadOpenForum(ctx, forumId);
  yield* loadActiveClass(ctx, forum.classId);
  const access = yield* requireClassAccess(
    ctx,
    forum.classId,
    forum.schoolId,
    userId
  );

  return { ...access, forum };
});

/** Loads a forum whose class is still active and verifies access. */
export const loadActiveForumWithAccess = Effect.fn(
  "school.forums.loadActiveForumWithAccess"
)(function* (
  ctx: DatabaseCtx,
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  const forum = yield* loadForum(ctx, forumId);
  yield* loadActiveClass(ctx, forum.classId);
  const access = yield* requireClassAccess(
    ctx,
    forum.classId,
    forum.schoolId,
    userId
  );

  return { ...access, forum };
});
