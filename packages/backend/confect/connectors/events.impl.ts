import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/connectors/events.spec";
import { eventTitleField } from "@repo/backend/confect/connectors/mirror";
import { readLearnerKeys } from "@repo/backend/confect/vault/keys";
import { openText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Layer } from "effect";

/** A day in milliseconds, how long before the window an event may start and still run in it. */
const DAY = 86_400_000;

/** The most events Nina reads in one call. */
const UPCOMING_LIMIT = 50;

/**
 * The account's events in the window, the soonest first: the mirror is read by
 * start from `from` less a day, so an event that began before the window and is
 * still running counts, and each title is opened with the account's key.
 */
const upcoming = FunctionImpl.make(
  databaseSchema,
  spec,
  "upcoming",
  Effect.fn("connectors.events.upcoming")(function* ({ from, until, userId }) {
    const rows = yield* (yield* DatabaseReader)
      .table("connectorEvents")
      .index("by_userId_and_start", (query) =>
        query
          .eq("userId", userId)
          .gte("start", from - DAY)
          .lt("start", until)
      )
      .take(UPCOMING_LIMIT)
      .pipe(Effect.orDie);
    const running = Arr.filter(rows, (row) => row.end > from);
    if (Arr.isReadonlyArrayEmpty(running)) {
      return [];
    }
    const keys = yield* readLearnerKeys(userId).pipe(Effect.orDie);
    return yield* Effect.forEach(running, (row) =>
      openText(
        keys,
        eventTitleField(row.connectionId, row.eventId),
        row.sealedTitle
      ).pipe(
        Effect.map((title) => ({
          allDay: row.allDay,
          end: row.end,
          start: row.start,
          title,
        })),
        Effect.orDie
      )
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(upcoming),
  GroupImpl.finalize
);
