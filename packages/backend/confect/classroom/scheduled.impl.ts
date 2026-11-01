import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassroomScheduledDoc } from "@repo/backend/confect/_generated/docs";
import classroomInternal from "@repo/backend/confect/_generated/refs/classroom.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import {
  ScheduledLimit,
  ScheduledPast,
} from "@repo/backend/confect/classroom/errors";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { announce } from "@repo/backend/confect/classroom/posts/announce";
import { postField } from "@repo/backend/confect/classroom/posts/post";
import { SCHEDULED_LIMIT } from "@repo/backend/confect/classroom/posts/scheduled";
import spec from "@repo/backend/confect/classroom/scheduled.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Layer,
  Option,
  Struct,
} from "effect";

/** The announcement as its author reads it. */
const scheduledView = Effect.fn("classroom.scheduled.view")(function* (
  row: ClassroomScheduledDoc
) {
  const keys = yield* schoolKeys(row.tenantId);
  return {
    clientKey: row.clientKey,
    email: row.email,
    id: row._id,
    publishAt: row.publishAt,
    text: yield* openText(keys, postField(row), row.sealedText).pipe(
      Effect.orDie
    ),
  };
});

/** The caller's own waiting announcement of the allowed class; any other is refused as a missing object. */
const ownScheduled = Effect.fn("classroom.scheduled.own")(function* (
  scheduledId: GenericId.GenericId<"classroomScheduled">
) {
  const { person } = yield* Member;
  const row = yield* Class;
  const found = yield* (yield* DatabaseReader)
    .table("classroomScheduled")
    .get(scheduledId)
    .pipe(Effect.option);
  if (
    Option.isNone(found) ||
    found.value.classId !== row._id ||
    found.value.authorId !== person._id
  ) {
    return yield* new AccessDenied({
      action: "post.publish",
      reason: "resource",
    });
  }
  return found.value;
});

/**
 * The run that posts a waiting announcement at its time, refused for a time that has passed. It names the row by its
 * class and client key, so the row can hold the run it was written with.
 */
const releaseJob = Effect.fn("classroom.scheduled.job")(function* (
  row: Pick<ClassroomScheduledDoc, "classId" | "clientKey">,
  publishAt: number
) {
  if (publishAt <= (yield* Clock.currentTimeMillis)) {
    return yield* new ScheduledPast();
  }
  return yield* (yield* Scheduler).runAt(
    DateTime.makeUnsafe(publishAt),
    classroomInternal.scheduled.release,
    { classId: row.classId, clientKey: row.clientKey }
  );
});

/** The class's announcements that wait for their time, the soonest first, that the caller wrote. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.scheduled.list")(function* () {
    const { person } = yield* Member;
    const row = yield* Class;
    const waiting = yield* (yield* DatabaseReader)
      .table("classroomScheduled")
      .index("by_classId_and_publishAt", (query) =>
        query.eq("classId", row._id)
      )
      .take(SCHEDULED_LIMIT)
      .pipe(Effect.orDie);
    return yield* Effect.forEach(
      Arr.filter(waiting, (found) => found.authorId === person._id),
      scheduledView
    );
  })
);

/**
 * Keeps an announcement for its time, sealed with the school key. A repeat of a client key of the class answers that
 * announcement and writes nothing. A class that holds the most it can refuses another.
 */
const schedule = FunctionImpl.make(
  databaseSchema,
  spec,
  "schedule",
  Effect.fn("classroom.scheduled.schedule")(function* ({
    clientKey,
    email,
    publishAt,
    text,
  }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const reader = yield* DatabaseReader;
    const sent = yield* reader
      .table("classroomScheduled")
      .index("by_classId_and_clientKey", (query) =>
        query.eq("classId", row._id).eq("clientKey", clientKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(sent)) {
      return yield* scheduledView(sent.value);
    }
    const waiting = yield* reader
      .table("classroomScheduled")
      .index("by_classId_and_publishAt", (query) =>
        query.eq("classId", row._id)
      )
      .take(SCHEDULED_LIMIT)
      .pipe(Effect.orDie);
    if (waiting.length >= SCHEDULED_LIMIT) {
      return yield* new ScheduledLimit();
    }
    const fields = { classId: row._id, clientKey };
    const scheduledId = yield* (yield* DatabaseWriter)
      .table("classroomScheduled")
      .insert({
        ...fields,
        authorId: person._id,
        createdAt: yield* Clock.currentTimeMillis,
        email,
        jobId: yield* releaseJob(fields, publishAt),
        publishAt,
        sealedText: yield* sealText(
          yield* schoolKeys(row.tenantId),
          postField(fields),
          text
        ).pipe(Effect.orDie),
        tenantId: row.tenantId,
      })
      .pipe(Effect.orDie);
    return yield* scheduledView(
      yield* reader
        .table("classroomScheduled")
        .get(scheduledId)
        .pipe(Effect.orDie)
    );
  })
);

/** Moves the caller's waiting announcement to a new time, and rewrites it. */
const edit = FunctionImpl.make(
  databaseSchema,
  spec,
  "edit",
  Effect.fn("classroom.scheduled.edit")(function* ({
    publishAt,
    scheduledId,
    text,
  }) {
    const row = yield* Class;
    const found = yield* ownScheduled(scheduledId);
    const jobId = yield* releaseJob(found, publishAt);
    yield* (yield* Scheduler).cancel(found.jobId);
    const edited = Struct.assign(found, {
      jobId,
      publishAt,
      sealedText: yield* sealText(
        yield* schoolKeys(row.tenantId),
        postField(found),
        text
      ).pipe(Effect.orDie),
    });
    yield* (yield* DatabaseWriter)
      .table("classroomScheduled")
      .replace(found._id, Struct.omit(edited, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    return yield* scheduledView(edited);
  })
);

/** Cancels the caller's waiting announcement, which nobody ever read. */
const cancel = FunctionImpl.make(
  databaseSchema,
  spec,
  "cancel",
  Effect.fn("classroom.scheduled.cancel")(function* ({ scheduledId }) {
    const found = yield* ownScheduled(scheduledId);
    yield* (yield* Scheduler).cancel(found.jobId);
    yield* (yield* DatabaseWriter)
      .table("classroomScheduled")
      .delete(found._id)
      .pipe(Effect.orDie);
    return null;
  })
);

/** Posts an announcement whose time came, as any announcement is posted. One cancelled meanwhile leaves nothing to do. */
const release = FunctionImpl.make(
  databaseSchema,
  spec,
  "release",
  Effect.fn("classroom.scheduled.release")(function* ({ classId, clientKey }) {
    const reader = yield* DatabaseReader;
    const found = yield* reader
      .table("classroomScheduled")
      .index("by_classId_and_clientKey", (query) =>
        query.eq("classId", classId).eq("clientKey", clientKey)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(found)) {
      return null;
    }
    const row = yield* reader.table("classes").get(classId).pipe(Effect.orDie);
    const author = yield* reader
      .table("tenantPeople")
      .get(found.value.authorId)
      .pipe(Effect.orDie);
    yield* announce(row, author, found.value);
    yield* (yield* DatabaseWriter)
      .table("classroomScheduled")
      .delete(found.value._id)
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(schedule),
  Layer.provide(edit),
  Layer.provide(cancel),
  Layer.provide(release),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
