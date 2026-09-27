import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  loadActiveClass,
  requireClassAccess,
} from "@repo/backend/confect/classes/access";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/**
 * Load a forum by ID.
 */
export const loadForum = Effect.fn("classes.forums.loadForum")(function* (
  forumId: Id<"schoolClassForums">
) {
  const forum = yield* (yield* DatabaseReader)
    .table("schoolClassForums")
    .get(forumId)
    .pipe(
      Effect.catchTag("DocumentDecodeError", Effect.die),
      Effect.mapError(
        () =>
          new ForumError({
            code: "FORUM_NOT_FOUND",
            message: "Forum not found.",
          })
      )
    );
  return forum;
});

/**
 * Load one forum and reject locked or archived threads before any write path
 * continues.
 */
const loadOpenForum = Effect.fn("classes.forums.loadOpenForum")(function* (
  forumId: Id<"schoolClassForums">
) {
  const forum = yield* loadForum(forumId);
  if (forum.status !== "open") {
    return yield* new ForumError({
      code: "FORUM_LOCKED",
      message: "This forum is locked.",
    });
  }
  return forum;
});
/**
 * Load a forum and verify the user can access its class.
 */
export const loadForumWithAccess = Effect.fn(
  "classes.forums.loadForumWithAccess"
)(function* (forumId: Id<"schoolClassForums">, userId: Id<"users">) {
  const forum = yield* loadForum(forumId);
  const access = yield* requireClassAccess(
    forum.classId,
    forum.schoolId,
    userId
  );
  return {
    forum,
    ...access,
  };
});

/**
 * Load an open forum in an active class and verify the user can access it.
 */
export const loadOpenForumWithAccess = Effect.fn(
  "classes.forums.loadOpenForumWithAccess"
)(function* (forumId: Id<"schoolClassForums">, userId: Id<"users">) {
  const forum = yield* loadOpenForum(forumId);
  yield* loadActiveClass(forum.classId);
  const access = yield* requireClassAccess(
    forum.classId,
    forum.schoolId,
    userId
  );
  return {
    forum,
    ...access,
  };
});

/**
 * Load any forum in an active class and verify the user can access it.
 */
export const loadActiveForumWithAccess = Effect.fn(
  "classes.forums.loadActiveForumWithAccess"
)(function* (forumId: Id<"schoolClassForums">, userId: Id<"users">) {
  const forum = yield* loadForum(forumId);
  yield* loadActiveClass(forum.classId);
  const access = yield* requireClassAccess(
    forum.classId,
    forum.schoolId,
    userId
  );
  return {
    forum,
    ...access,
  };
});
