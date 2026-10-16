import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { NotificationCursorInvalid } from "@repo/backend/confect/notifications/errors";
import {
  HELD_SCHOOL_LIMIT,
  type HeldSchool,
} from "@repo/backend/confect/notifications/held";
import { notificationView } from "@repo/backend/confect/notifications/schema";
import { Array as Arr, Effect, Option, Order, pipe, Schema } from "effect";

/**
 * Where one page of the inbox list ends: the creation time of its last row, and
 * the rows at that time that earlier pages already showed. The next page shows
 * the rows older than that time, and the rows at that time that it has not shown.
 */
const FeedCursor = Schema.Struct({
  at: Schema.Finite,
  shown: Schema.Array(Id("notifications")),
});
type FeedCursor = typeof FeedCursor.Type;
/** The page cursor as the list sends it: the JSON text of a position. */
export const FeedCursorJson = Schema.fromJsonString(FeedCursor);

/**
 * Reads the position of a list page. A cursor that does not decode is refused, and
 * so is one that names more rows at its time than the account can hold. Each school
 * adds at most one row at a creation time, because a Person's invitations are
 * written one after another and their rows never share a time. So the rows at one
 * creation time number at most `HELD_SCHOOL_LIMIT`, and no cursor sizes a read past
 * that bound.
 */
export const decodeFeedCursor = Effect.fn("notifications.feed.decodeCursor")(
  function* (cursor: string | null) {
    if (cursor === null) {
      return null;
    }
    const decoded = yield* Schema.decodeEffect(FeedCursorJson)(cursor).pipe(
      Effect.mapError(() => new NotificationCursorInvalid())
    );
    if (decoded.shown.length > HELD_SCHOOL_LIMIT) {
      return yield* new NotificationCursorInvalid();
    }
    return decoded;
  }
);

const encodeFeedCursor = (cursor: FeedCursor) =>
  Schema.encodeEffect(FeedCursorJson)(cursor).pipe(Effect.orDie);

/**
 * The newest rows of one school after the cursor, from one indexed range. It
 * reads `readAhead` rows, so the page and one row past it are always there, and
 * the rows at the cursor's time that the page must skip.
 */
const streamOf = Effect.fn("notifications.feed.stream")(function* (
  school: HeldSchool,
  cursor: FeedCursor | null,
  readAhead: number
) {
  return yield* (yield* DatabaseReader)
    .table("notifications")
    .index(
      "by_recipientPersonId_and_createdAt",
      (query) =>
        cursor === null
          ? query.eq("recipientPersonId", school.person._id)
          : query
              .eq("recipientPersonId", school.person._id)
              .lte("createdAt", cursor.at),
      "desc"
    )
    .take(readAhead)
    .pipe(
      Effect.orDie,
      Effect.map((rows) =>
        Arr.map(rows, (row) => ({ row, school: school.tenant }))
      )
    );
});

/** A row with the school it belongs to, as the merged list holds it. */
type Candidate = Effect.Success<ReturnType<typeof streamOf>>[number];

/** Whether an earlier page already showed this row. */
const isShown = (cursor: FeedCursor | null, row: Candidate["row"]) =>
  cursor !== null &&
  row.createdAt === cursor.at &&
  Arr.contains(cursor.shown, row._id);

/**
 * One page of the inbox list: the newest rows of every school the account holds,
 * merged into one order by creation time, newest first. Rows that share a creation
 * time keep the order of the index, which breaks ties by the newest insert, so every
 * page size shows the same order. Rows that tie on both keep the order of their
 * school. The cursor keeps the rows at its time that it has shown, so no row is
 * shown twice or skipped, even when several rows share one creation time. Each
 * school is read with at most `numItems + 1 + HELD_SCHOOL_LIMIT` rows, because a
 * decoded cursor names at most `HELD_SCHOOL_LIMIT` rows.
 */
export const feedPage = Effect.fn("notifications.feed.page")(function* (
  schools: readonly HeldSchool[],
  cursor: FeedCursor | null,
  numItems: number
) {
  const readAhead = numItems + 1 + (cursor === null ? 0 : cursor.shown.length);
  const streams = yield* Effect.forEach(
    schools,
    (school) => streamOf(school, cursor, readAhead),
    { concurrency: "unbounded" }
  );
  const sorted = pipe(
    Arr.flatten(streams),
    Arr.filter((candidate) => !isShown(cursor, candidate.row)),
    Arr.sortBy(
      Order.mapInput(
        Order.flip(Order.Number),
        (candidate: Candidate) => candidate.row.createdAt
      ),
      Order.mapInput(
        Order.flip(Order.Number),
        (candidate: Candidate) => candidate.row._creationTime
      )
    )
  );
  const ahead = Arr.take(sorted, numItems + 1);
  const rows = Arr.take(ahead, numItems);
  const continueCursor = yield* Option.match(Arr.last(rows), {
    onNone: () =>
      cursor === null ? Effect.succeed("") : encodeFeedCursor(cursor),
    onSome: (last) => {
      const at = last.row.createdAt;
      const carried = cursor !== null && cursor.at === at ? cursor.shown : [];
      const shown = Arr.appendAll(
        carried,
        Arr.map(
          Arr.filter(rows, (candidate) => candidate.row.createdAt === at),
          (candidate) => candidate.row._id
        )
      );
      return encodeFeedCursor({ at, shown });
    },
  });
  return {
    continueCursor,
    isDone: ahead.length <= numItems,
    page: Arr.map(rows, (candidate) =>
      notificationView(candidate.row, candidate.school)
    ),
  };
});
