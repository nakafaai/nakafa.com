import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  loadActiveClass,
  requireClassAccess,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import { Effect } from "effect";

/** Loads a forum row by id. */
export const loadForum = Effect.fnUntraced(function* (
  forumId: Id<"schoolClassForums">
) {
  const reader = yield* DatabaseReader;

  return yield* reader
    .table("schoolClassForums")
    .get(forumId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () =>
        Effect.fail(new ClassActionError({ message: "Forum not found." }))
      )
    );
});

/** Loads a forum that accepts new posts. */
export const loadOpenForum = Effect.fnUntraced(function* (
  forumId: Id<"schoolClassForums">
) {
  const forum = yield* loadForum(forumId);

  if (forum.status !== "open") {
    return yield* Effect.fail(
      new ClassActionError({ message: "This forum is locked." })
    );
  }

  return forum;
});

/** Loads a forum and verifies class access. */
export const loadForumWithAccess = Effect.fnUntraced(function* (
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  const forum = yield* loadForum(forumId);
  const access = yield* requireClassAccess(
    forum.classId,
    forum.schoolId,
    userId
  );

  return { ...access, forum };
});

/** Loads an open forum whose class is still active and verifies access. */
export const loadOpenForumWithAccess = Effect.fnUntraced(function* (
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  const forum = yield* loadOpenForum(forumId);
  yield* loadActiveClass(forum.classId);
  const access = yield* requireClassAccess(
    forum.classId,
    forum.schoolId,
    userId
  );

  return { ...access, forum };
});

/** Loads a forum whose class is still active and verifies access. */
export const loadActiveForumWithAccess = Effect.fnUntraced(function* (
  forumId: Id<"schoolClassForums">,
  userId: Id<"users">
) {
  const forum = yield* loadForum(forumId);
  yield* loadActiveClass(forum.classId);
  const access = yield* requireClassAccess(
    forum.classId,
    forum.schoolId,
    userId
  );

  return { ...access, forum };
});
