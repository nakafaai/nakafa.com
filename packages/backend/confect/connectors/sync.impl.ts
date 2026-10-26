import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { markReconnect } from "@repo/backend/confect/connectors/connection";
import { upcomingEvents } from "@repo/backend/confect/connectors/google/calendar";
import { courseWork } from "@repo/backend/confect/connectors/google/classroom";
import { readGoogleClient } from "@repo/backend/confect/connectors/google/client";
import { refreshAccess } from "@repo/backend/confect/connectors/google/oauth";
import { eventTitleField } from "@repo/backend/confect/connectors/mirror";
import { connectionToken } from "@repo/backend/confect/connectors/secret";
import spec from "@repo/backend/confect/connectors/sync.spec";
import { Space } from "@repo/backend/confect/space";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import { FetchClient } from "@repo/utilities/http/client";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Layer,
  Option,
  Record as Rec,
} from "effect";

/** The most due connections one sweep schedules. */
const SWEEP_LIMIT = 50;

/**
 * The most runs of one owner that a sweep schedules, so the connections of one
 * school never fill a sweep ahead of another school's (ADR 0015).
 */
const SCHOOL_CAP = 5;

/** How long a scheduled run holds its connection before a later sweep may take it again. */
const SYNC_LEASE = Duration.minutes(15);

/** The time between the runs that one sweep schedules, so they do not reach Google at once. */
const RUN_SPREAD = Duration.seconds(2);

/** When a source that changed is read again. */
const BUSY_INTERVAL = Duration.minutes(30);

/** When a source that did not change is read again. */
const QUIET_INTERVAL = Duration.hours(3);

/** When a source is read again: sooner after it changed, later after it did not. */
const nextInterval = (changed: boolean) =>
  changed ? BUSY_INTERVAL : QUIET_INTERVAL;

/** The most stored events of one connection that a sync replaces. */
const MIRROR_READ = 200;

/** Whose sync a run counts against: the school of a school connection, or the account. */
const ownerKey = (owner: Space) =>
  Space.match(owner, {
    personal: ({ userId }) => userId,
    tenant: ({ tenantId }) => tenantId,
  });

/**
 * Takes the active connections whose sync is due, at most `SCHOOL_CAP` of each
 * owner, leases each so no later sweep takes it while it runs, and schedules its
 * run, spread apart. A connection with no due time is never taken.
 */
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("connectors.sync.sweep")(function* () {
    const now = yield* Clock.currentTimeMillis;
    const due = yield* (yield* DatabaseReader)
      .table("connectorConnections")
      .index("by_status_and_nextSyncAt", (query) =>
        query.eq("status", "active").gte("nextSyncAt", 0).lte("nextSyncAt", now)
      )
      .take(SWEEP_LIMIT)
      .pipe(Effect.orDie);
    const picked = Arr.flatMap(
      Rec.values(Arr.groupBy(due, (row) => ownerKey(row.owner))),
      (rows) => Arr.take(rows, SCHOOL_CAP)
    );
    const writer = yield* DatabaseWriter;
    const scheduler = yield* Scheduler;
    yield* Effect.forEach(
      picked,
      (row, index) =>
        writer
          .table("connectorConnections")
          .patch(row._id, { nextSyncAt: now + Duration.toMillis(SYNC_LEASE) })
          .pipe(
            Effect.andThen(
              scheduler.runAfter(
                Duration.times(RUN_SPREAD, index),
                refs.internal.connectors.sync.run,
                { connectionId: row._id }
              )
            )
          ),
      { discard: true }
    ).pipe(Effect.orDie);
    return { scheduled: picked.length };
  })
);

/**
 * What a run of an active connection reads first: its connector, its owner, and
 * its refresh token opened with the owner's key. A connection that ended or waits
 * to reconnect has none.
 */
const target = FunctionImpl.make(
  databaseSchema,
  spec,
  "target",
  Effect.fn("connectors.sync.target")(function* ({ connectionId }) {
    const reader = yield* DatabaseReader;
    const row = yield* reader
      .table("connectorConnections")
      .get(connectionId)
      .pipe(Effect.option);
    if (Option.isNone(row) || row.value.status !== "active") {
      return null;
    }
    const refreshToken = yield* connectionToken(row.value);
    if (Option.isNone(refreshToken)) {
      return null;
    }
    return {
      connector: row.value.connector,
      owner: row.value.owner,
      refreshToken: refreshToken.value,
    };
  })
);

/** Imports the coursework of each linked course of a Classroom connection, and sets its next sync. */
const syncClassroom = Effect.fn("connectors.sync.classroom")(function* (
  connectionId: GenericId.GenericId<"connectorConnections">,
  accessToken: string
) {
  const { runQuery } = yield* QueryRunner;
  const { runMutation } = yield* MutationRunner;
  const linked = yield* runQuery(refs.internal.connectors.classroom.links, {
    connectionId,
  }).pipe(Effect.orDie);
  const stored = yield* Effect.forEach(linked, ({ courseId }) =>
    courseWork(accessToken, courseId).pipe(
      Effect.flatMap((works) =>
        runMutation(refs.internal.connectors.classroom.storeWork, {
          connectionId,
          courseId,
          works,
        }).pipe(Effect.orDie)
      )
    )
  );
  yield* runMutation(refs.internal.connectors.sync.settle, {
    changed: Arr.some(stored, (result) => result.changed),
    connectionId,
  }).pipe(Effect.orDie);
});

/** Reads the account's coming events and stores them, which sets the next sync. */
const syncCalendar = Effect.fn("connectors.sync.calendar")(function* (
  connectionId: GenericId.GenericId<"connectorConnections">,
  accessToken: string
) {
  const { runMutation } = yield* MutationRunner;
  const events = yield* upcomingEvents(
    accessToken,
    yield* Clock.currentTimeMillis
  );
  yield* runMutation(refs.internal.connectors.sync.storeEvents, {
    connectionId,
    events,
  }).pipe(Effect.orDie);
});

/**
 * Syncs one connection. Calendar reads the account's coming events and stores
 * them, Classroom imports its linked courses' coursework into their classes; a
 * connector that keeps no copy has nothing to read. A connector this
 * deployment no longer offers reads nothing, and its lease ends on its own. A
 * token that Google no longer accepts moves the connection to `reconnect`; any
 * other failure of Google leaves the lease to bring the sync back later.
 */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("connectors.sync.run")(function* ({ connectionId }) {
    const { runQuery } = yield* QueryRunner;
    const { runMutation } = yield* MutationRunner;
    const found = yield* runQuery(refs.internal.connectors.sync.target, {
      connectionId,
    }).pipe(Effect.orDie);
    if (
      found === null ||
      (found.connector !== "calendar" && found.connector !== "classroom")
    ) {
      return null;
    }
    const connector = found.connector;
    const client = yield* readGoogleClient(connector).pipe(Effect.option);
    if (Option.isNone(client)) {
      return null;
    }
    yield* refreshAccess(client.value, found.refreshToken).pipe(
      Effect.flatMap((accessToken) =>
        connector === "calendar"
          ? syncCalendar(connectionId, accessToken)
          : syncClassroom(connectionId, accessToken)
      ),
      Effect.provide(FetchClient),
      Effect.catchTag("GoogleFailed", (failure) =>
        failure.reason === "revoked"
          ? runMutation(refs.internal.connectors.sync.reconnect, {
              connectionId,
            })
          : Effect.logWarning("connectors.sync.google", failure.reason)
      ),
      Effect.orDie
    );
    return null;
  })
);

/**
 * Replaces the Calendar mirror of a personal connection with the events a run
 * read, each title sealed with the account's key, and sets the next sync: sooner
 * when the events changed, later when they did not. A connection that ended
 * while the run read keeps no event.
 */
const storeEvents = FunctionImpl.make(
  databaseSchema,
  spec,
  "storeEvents",
  Effect.fn("connectors.sync.storeEvents")(function* ({
    connectionId,
    events,
  }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const row = yield* reader
      .table("connectorConnections")
      .get(connectionId)
      .pipe(Effect.orDie);
    if (row.status !== "active" || row.owner.kind !== "personal") {
      return null;
    }
    const userId = row.owner.userId;
    const stored = yield* reader
      .table("connectorEvents")
      .index("by_connectionId_and_start", (query) =>
        query.eq("connectionId", connectionId)
      )
      .take(MIRROR_READ)
      .pipe(Effect.orDie);
    const shape = (event: {
      readonly end: number;
      readonly eventId: string;
      readonly start: number;
    }) => `${event.eventId}:${event.start}:${event.end}`;
    const changed =
      Arr.join(Arr.map(stored, shape), "|") !==
      Arr.join(Arr.map(events, shape), "|");
    yield* Effect.forEach(
      stored,
      (event) => writer.table("connectorEvents").delete(event._id),
      { discard: true }
    ).pipe(Effect.orDie);
    const keys = yield* ensureLearnerKeys(userId).pipe(Effect.orDie);
    yield* Effect.forEach(
      events,
      (event) =>
        sealText(
          keys,
          eventTitleField(connectionId, event.eventId),
          event.title
        ).pipe(
          Effect.flatMap((sealedTitle) =>
            writer.table("connectorEvents").insert({
              allDay: event.allDay,
              connectionId,
              end: event.end,
              eventId: event.eventId,
              sealedTitle,
              start: event.start,
              userId,
            })
          )
        ),
      { discard: true }
    ).pipe(Effect.orDie);
    const now = yield* Clock.currentTimeMillis;
    yield* writer
      .table("connectorConnections")
      .patch(connectionId, {
        lastSyncedAt: now,
        nextSyncAt: now + Duration.toMillis(nextInterval(changed)),
      })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Sets the next sync of a connection after a run: sooner when its source changed, later when it did not. */
const settle = FunctionImpl.make(
  databaseSchema,
  spec,
  "settle",
  Effect.fn("connectors.sync.settle")(function* ({ changed, connectionId }) {
    const now = yield* Clock.currentTimeMillis;
    yield* (yield* DatabaseWriter)
      .table("connectorConnections")
      .patch(connectionId, {
        lastSyncedAt: now,
        nextSyncAt: now + Duration.toMillis(nextInterval(changed)),
      })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Moves a connection whose token Google refused to `reconnect`. */
const reconnect = FunctionImpl.make(
  databaseSchema,
  spec,
  "reconnect",
  Effect.fn("connectors.sync.reconnect")(function* ({ connectionId }) {
    const row = yield* (yield* DatabaseReader)
      .table("connectorConnections")
      .get(connectionId)
      .pipe(Effect.orDie);
    yield* markReconnect(row);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(sweep),
  Layer.provide(target),
  Layer.provide(run),
  Layer.provide(storeEvents),
  Layer.provide(settle),
  Layer.provide(reconnect),
  GroupImpl.finalize
);
