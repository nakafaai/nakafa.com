import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import session from "@repo/backend/confect/middleware/session.impl";
import { detailOf } from "@repo/backend/confect/notifications/detail";
import { NotificationNotFound } from "@repo/backend/confect/notifications/errors";
import {
  decodeFeedCursor,
  feedPage,
} from "@repo/backend/confect/notifications/feed";
import {
  heldPersons,
  heldSchools,
  holds,
} from "@repo/backend/confect/notifications/held";
import spec from "@repo/backend/confect/notifications/inbox.spec";
import { notificationView } from "@repo/backend/confect/notifications/schema";
import { tenantProfile } from "@repo/backend/confect/tenancy/profile";
import { Clock, Duration, Effect, Layer, Number as Num } from "effect";

/**
 * The most rows one list page returns. The journal audit holds its pages to the
 * same number (ADR 0016).
 */
export const LIST_PAGE_LIMIT = 100;

/** Marks one row read. A row of an unheld Person is refused like a missing row. */
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
    const profile = yield* tenantProfile(tenant);
    const detail = yield* detailOf(row, person, tenant);
    if (row.readAt !== undefined) {
      return notificationView(row, profile, detail);
    }
    const readAt = yield* Clock.currentTimeMillis;
    yield* (yield* DatabaseWriter)
      .table("notifications")
      .patch(row._id, { readAt })
      .pipe(Effect.orDie);
    return notificationView({ ...row, readAt }, profile, detail);
  })
);

/**
 * The rows of the signed-in account's schools, newest first, one page at a time.
 * Only the Persons the account holds are read, so a row of another Person never
 * shows.
 */
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
 * Marks the unread rows of every Person the account holds. Each Person's rows
 * are marked by a scheduled run that reads one page, so a request reads no rows
 * itself and no run reads more than one page. The rows of a read request share
 * one moment, the request's.
 */
const readAll = FunctionImpl.make(
  databaseSchema,
  spec,
  "readAll",
  Effect.fn("notifications.inbox.readAll")(function* () {
    const { appUser } = yield* requireAuth();
    const readAt = yield* Clock.currentTimeMillis;
    const persons = yield* heldPersons(appUser._id);
    const scheduler = yield* Scheduler;
    yield* Effect.forEach(
      persons,
      (person) =>
        scheduler.runAfter(
          Duration.zero,
          refs.internal.notifications.read.run,
          {
            cursor: null,
            personId: person._id,
            readAt,
          }
        ),
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
