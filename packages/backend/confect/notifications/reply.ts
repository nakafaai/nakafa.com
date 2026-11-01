import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { findComment } from "@repo/backend/confect/comments/rows";
import { scheduleAccountPush } from "@repo/backend/confect/notifications/schedule";
import {
  type AccountRow,
  replyView,
} from "@repo/backend/confect/notifications/schema";
import { photoOf } from "@repo/backend/confect/users/picture";
import { Array as Arr, Effect, Option, Struct } from "effect";

/** Reply rows one pass of an account's deletion removes, inside one transaction. */
const CLEANUP_PAGE_SIZE = 50;

/**
 * Writes the inbox row of one reply, in the transaction of the reply, so a failed
 * reply leaves no row (ADR 0027), and schedules its push. One reply makes one row.
 */
export const noticeReply = Effect.fn("notifications.reply.write")(function* (
  commentId: GenericId.GenericId<"comments">,
  recipientUserId: GenericId.GenericId<"users">,
  createdAt: number
) {
  const notificationId = yield* (yield* DatabaseWriter)
    .table("notifications")
    .insert({
      changeType: "comment.replied",
      commentId,
      createdAt,
      recipientUserId,
    })
    .pipe(Effect.orDie);
  yield* scheduleAccountPush(notificationId, recipientUserId);
});

/** The public face of a reply's author, read when the row is read, or null once either is gone. */
const actorOf = Effect.fn("notifications.reply.actor")(function* (
  row: AccountRow
) {
  const comment = yield* findComment(row.commentId);
  if (comment === null) {
    return null;
  }
  const author = yield* (yield* DatabaseReader)
    .table("users")
    .get(comment.userId)
    .pipe(Effect.option);
  return Option.match(author, {
    onNone: () => null,
    onSome: (user) => {
      const photo = photoOf(user);
      return {
        ...Struct.pick(user, ["mascot", "name", "picture"]),
        ...(photo === undefined ? {} : { image: photo }),
      };
    },
  });
});

/** One reply's row as the wire shows it, with its author as they stand now. */
export const replyNotice = Effect.fn("notifications.reply.view")(function* (
  row: AccountRow
) {
  return replyView(row, yield* actorOf(row));
});

/** Deletes the row of a reply that was deleted, so the inbox opens no missing reply. */
export const purgeReply = Effect.fn("notifications.reply.purge")(function* (
  commentId: GenericId.GenericId<"comments">
) {
  const row = yield* (yield* DatabaseReader)
    .table("notifications")
    .index("by_commentId", (query) => query.eq("commentId", commentId))
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(row)) {
    yield* (yield* DatabaseWriter)
      .table("notifications")
      .delete(row.value._id)
      .pipe(Effect.orDie);
  }
});

/** Deletes one page of the rows of a deleted account, and says whether it deleted any. */
export const cleanupReplyRows = Effect.fn("notifications.reply.cleanup")(
  function* (userId: GenericId.GenericId<"users">) {
    const rows = yield* (yield* DatabaseReader)
      .table("notifications")
      .index("by_recipientUserId_and_createdAt", (query) =>
        query.eq("recipientUserId", userId)
      )
      .take(CLEANUP_PAGE_SIZE)
      .pipe(Effect.orDie);
    const writer = yield* DatabaseWriter;
    yield* Effect.forEach(
      rows,
      (row) => writer.table("notifications").delete(row._id).pipe(Effect.orDie),
      { discard: true }
    );
    return Arr.isReadonlyArrayNonEmpty(rows);
  }
);
