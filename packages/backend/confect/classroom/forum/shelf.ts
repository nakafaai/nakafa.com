import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { archiveMark } from "@repo/backend/confect/classroom/archive";
import {
  classThread,
  missing,
} from "@repo/backend/confect/classroom/forum/lookup";
import type { DiscussionNumber } from "@repo/backend/confect/classroom/forum/message";
import { managesForum } from "@repo/backend/confect/classroom/forum/policy";
import spec from "@repo/backend/confect/classroom/forum/threads.spec";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect } from "effect";

/**
 * Archives a discussion, or restores it: an archived discussion leaves the class's list of
 * discussions and stays readable at its number. Whoever opened it may, and so may whoever manages
 * the class's forum; anyone else who writes in the class meets it as a missing object.
 */
const shelve = Effect.fn("classroom.forum.threads.shelve")(function* (
  number: typeof DiscussionNumber.Type,
  archived: boolean
) {
  const principal = yield* Member;
  const row = yield* Class;
  const thread = yield* classThread(number, "forum.post");
  if (thread.authorId !== principal.person._id && !(yield* managesForum(row))) {
    return yield* missing("forum.post");
  }
  yield* (yield* DatabaseWriter)
    .table("classroomThreads")
    .patch(thread._id, { archivedAt: yield* archiveMark(archived) })
    .pipe(Effect.orDie);
  return null;
});

/** Archives a discussion for whoever opened it or manages the forum. */
export const archive = FunctionImpl.make(
  databaseSchema,
  spec,
  "archive",
  Effect.fn("classroom.forum.threads.archive")(function* ({ number }) {
    return yield* shelve(number, true);
  })
);

/** Restores an archived discussion for whoever opened it or manages the forum. */
export const restore = FunctionImpl.make(
  databaseSchema,
  spec,
  "restore",
  Effect.fn("classroom.forum.threads.restore")(function* ({ number }) {
    return yield* shelve(number, false);
  })
);
