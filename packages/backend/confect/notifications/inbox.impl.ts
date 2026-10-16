import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import session from "@repo/backend/confect/middleware/session.impl";
import { NotificationNotFound } from "@repo/backend/confect/notifications/errors";
import { decodeFeedCursor, feedPage } from "@repo/backend/confect/notifications/feed";
import { heldPersons, heldSchools, holds } from "@repo/backend/confect/notifications/held";
import spec from "@repo/backend/confect/notifications/inbox.spec";
import { notificationView } from "@repo/backend/confect/notifications/schema";
import { Array as Arr, Clock, Effect, Layer, Number as Num } from "effect";

/** The most rows one list request reads for each school it holds. */
const LIST_PAGE_LIMIT = 100;

/** Rows one read-all page reads and marks, inside one transaction. */
const READ_ALL_PAGE_SIZE = 50;

/**
 * Marks every unread row of one Person that the account holds, a page at a time,
 * and leaves the read rows as they are, so a repeated call writes nothing new.
 */
const markAllRead = Effect.fn("notifications.inbox.markAllRead")(function* (
  personId: GenericId.GenericId<"tenantPeople">,
  readAt: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const pageAt = (cursor: string | null): Effect.Effect<void> =>
    reader
      .table("notifications")
      .index("by_recipientPersonId_and_createdAt", (query) =>
        query.eq("recipientPersonId", personId)
      )
      .paginate({ cursor, numItems: READ_ALL_PAGE_SIZE })
      .pipe(
        Effect.orDie,
        Effect.flatMap((page) =>
          Effect.forEach(
            Arr.filter(page.page, (row) => row.readAt === undefined),
            (row) =>
              writer
                .table("notifications")
                .patch(row._id, { readAt })
                .pipe(Effect.orDie),
            { discard: true }
          ).pipe(
            Effect.flatMap(() =>
              page.isDone ? Effect.void : pageAt(page.continueCursor)
            )
          )
        )
      );
  yield* pageAt(null);
});

/** The rows of the signed-in account's schools, newest first, one page at a time. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("notifications.inbox.list")(function* ({ paginationOpts }) {
    const { appUser } = yield* requireAuth();
    const cursor = yield* decodeFeedCursor(paginationOpts.cursor);
    const schools = yield* heldSchools(appUser._id);
    return yield* feedPage(
      schools,
      cursor,
      Num.min(paginationOpts.numItems, LIST_PAGE_LIMIT)
    );
  })
);

/**
 * Marks one row read. A row the account does not hold gets the same answer as a
 * row that does not exist. Reading a row that is read already changes nothing.
 */
const read = FunctionImpl.make(
  databaseSchema,
  spec,
  "read",
  Effect.fn("notifications.inbox.read")(function* ({ notificationId }) {
    const { appUser } = yield* requireAuth();
    const reader = yield* DatabaseReader;
    const row = yield* reader
      .table("notifications")
      .get(notificationId)
      .pipe(
        Effect.catchTags({
          DocumentDecodeError: Effect.die,
          GetByIdFailure: () => new NotificationNotFound(),
        })
      );
    const person = yield* reader
      .table("tenantPeople")
      .get(row.recipientPersonId)
      .pipe(Effect.orDie);
    if (!holds(person, appUser._id)) {
      return yield* new NotificationNotFound();
    }
    const tenant = yield* reader
      .table("tenants")
      .get(row.tenantId)
      .pipe(Effect.orDie);
    if (row.readAt !== undefined) {
      return notificationView(row, tenant);
    }
    const readAt = yield* Clock.currentTimeMillis;
    yield* (yield* DatabaseWriter)
      .table("notifications")
      .patch(row._id, { readAt })
      .pipe(Effect.orDie);
    return notificationView({ ...row, readAt }, tenant);
  })
);

/** Marks every unread row of the account's Persons read. */
const readAll = FunctionImpl.make(
  databaseSchema,
  spec,
  "readAll",
  Effect.fn("notifications.inbox.readAll")(function* () {
    const { appUser } = yield* requireAuth();
    const readAt = yield* Clock.currentTimeMillis;
    const persons = yield* heldPersons(appUser._id);
    yield* Effect.forEach(
      persons,
      (person) => markAllRead(person._id, readAt),
      { discard: true }
    );
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(read),
  Layer.provide(readAll),
  Layer.provide(session),
  GroupImpl.finalize
);
