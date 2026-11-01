import type {
  ClassesDoc,
  ClassroomPostsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import notificationsInternal from "@repo/backend/confect/_generated/refs/notifications.server";
import {
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, Duration, Effect } from "effect";

/**
 * Posts an announcement to the class with its text already sealed, records `announcement.posted`, the published change,
 * and schedules the fan-out that writes the inbox row of every member of the class in batches (ADR 0027); Convex
 * schedules it only if the post commits.
 */
export const announce = Effect.fn("classroom.posts.announce")(function* (
  row: ClassesDoc,
  author: TenantPeopleDoc,
  post: Pick<ClassroomPostsDoc, "clientKey" | "email" | "poll" | "sealedText">
) {
  const postId = yield* (yield* DatabaseWriter)
    .table("classroomPosts")
    .insert({
      authorId: author._id,
      classId: row._id,
      clientKey: post.clientKey,
      createdAt: yield* Clock.currentTimeMillis,
      email: post.email,
      ...(post.poll === undefined ? {} : { poll: post.poll }),
      sealedText: post.sealedText,
      tenantId: row.tenantId,
    })
    .pipe(Effect.orDie);
  yield* classAuthority.record(personActor(author), row, {
    post: postId,
    type: "announcement.posted",
  });
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    notificationsInternal.fanout.run,
    { cursor: null, phase: "students", source: { _tag: "post", postId } }
  );
  return postId;
});
