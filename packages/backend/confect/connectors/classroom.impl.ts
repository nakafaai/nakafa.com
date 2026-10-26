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
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { Class } from "@repo/backend/confect/classroom/access";
import { TaskTitle } from "@repo/backend/confect/classroom/tasks/task";
import { writeTask } from "@repo/backend/confect/classroom/tasks/write";
import spec from "@repo/backend/confect/connectors/classroom.spec";
import {
  courseStudents,
  teacherCourses,
} from "@repo/backend/confect/connectors/google/classroom";
import { readGoogleClient } from "@repo/backend/confect/connectors/google/client";
import { refreshAccess } from "@repo/backend/confect/connectors/google/oauth";
import { openRefreshToken } from "@repo/backend/confect/connectors/secret";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { FetchClient } from "@repo/utilities/http/client";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Layer,
  Number as Num,
  Option,
  Schema,
  String as Str,
} from "effect";

/** The most linked courses of one connection that a sync reads. */
const LINK_LIMIT = 50;

/** The most classes of the school that a preview offers to link a course to. */
const CLASS_LIMIT = 300;

/** How many courses a preview counts the students of at once. */
const PREVIEW_CONCURRENCY = 5;

/** Characters that a task title keeps on one line: line breaks and controls become a space. */
const LINE_BREAKS = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;

/** Characters that a client key does not hold. */
const KEY_UNSAFE = /[^A-Za-z0-9-]/gu;

/** The refusal of a connection or a class that is not the school's own, as a missing object. */
const missing = () =>
  new AccessDenied({ action: "connection.create", reason: "resource" });

/** Answers nothing: the middleware is the check that the member may import. */
const canImport = FunctionImpl.make(
  databaseSchema,
  spec,
  "canImport",
  Effect.fn("connectors.classroom.canImport")(() => Effect.succeed({}))
);

/**
 * The school's newest active Classroom connection, its refresh token opened with
 * the school key, its links, and the school's active classes. A school without one
 * has none.
 */
const target = FunctionImpl.make(
  databaseSchema,
  spec,
  "target",
  Effect.fn("connectors.classroom.target")(function* ({ slug }) {
    const reader = yield* DatabaseReader;
    const tenant = yield* reader
      .table("tenants")
      .index("by_slug", (query) => query.eq("slug", slug))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(tenant)) {
      return null;
    }
    const connections = yield* reader
      .table("connectorConnections")
      .index(
        "by_tenantId_and_status",
        (query) =>
          query.eq("owner.tenantId", tenant.value._id).eq("status", "active"),
        "desc"
      )
      .take(LINK_LIMIT)
      .pipe(Effect.orDie);
    const connection = Arr.findFirst(
      connections,
      (row) => row.connector === "classroom"
    );
    if (Option.isNone(connection)) {
      return null;
    }
    const connectionId = connection.value._id;
    const secret = yield* reader
      .table("connectorSecrets")
      .index("by_connectionId", (query) =>
        query.eq("connectionId", connectionId)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(secret)) {
      return null;
    }
    const links = yield* reader
      .table("connectorLinks")
      .index("by_connectionId_and_courseId", (query) =>
        query.eq("connectionId", connectionId)
      )
      .take(LINK_LIMIT)
      .pipe(Effect.orDie);
    const classes = yield* reader
      .table("classes")
      .index("by_tenantId_and_slug", (query) =>
        query.eq("tenantId", tenant.value._id)
      )
      .take(CLASS_LIMIT)
      .pipe(Effect.orDie);
    return {
      classes: Arr.map(
        Arr.filter(classes, (row) => row.status === "active"),
        (row) => ({ id: row._id, name: row.name })
      ),
      connectionId,
      links: Arr.map(links, (link) => ({
        classId: link.classId,
        courseId: link.courseId,
      })),
      refreshToken: yield* openRefreshToken(
        connection.value.owner,
        connectionId,
        secret.value.refreshToken
      ).pipe(Effect.orDie),
    };
  })
);

/**
 * The courses the school's Classroom connection teaches, each with its number of
 * students and its linked class. A token that Google no longer accepts moves the
 * connection to `reconnect` and fails as `revoked`.
 */
const preview = FunctionImpl.make(
  databaseSchema,
  spec,
  "preview",
  Effect.fn("connectors.classroom.preview")(
    function* ({ slug }) {
      yield* requireAuth();
      const { runQuery } = yield* QueryRunner;
      const { runMutation } = yield* MutationRunner;
      yield* runQuery(refs.public.connectors.classroom.canImport, {
        slug,
      }).pipe(
        Effect.catchTag("NotMember", () =>
          Effect.fail(
            new AccessDenied({ action: "connection.view", reason: "role" })
          )
        )
      );
      const found = yield* runQuery(refs.internal.connectors.classroom.target, {
        slug,
      }).pipe(Effect.orDie);
      if (found === null) {
        return null;
      }
      const client = yield* readGoogleClient("classroom");
      const courses = yield* refreshAccess(client, found.refreshToken).pipe(
        Effect.flatMap((accessToken) =>
          teacherCourses(accessToken).pipe(
            Effect.flatMap((listed) =>
              Effect.forEach(
                listed,
                (course) =>
                  courseStudents(accessToken, course.courseId).pipe(
                    Effect.map((students) => ({
                      ...course,
                      classId: Option.getOrNull(
                        Option.map(
                          Arr.findFirst(
                            found.links,
                            (link) => link.courseId === course.courseId
                          ),
                          (link) => link.classId
                        )
                      ),
                      students,
                    }))
                  ),
                { concurrency: PREVIEW_CONCURRENCY }
              )
            )
          )
        ),
        Effect.provide(FetchClient),
        Effect.tapError((failure) =>
          failure.reason === "revoked"
            ? runMutation(refs.internal.connectors.sync.reconnect, {
                connectionId: found.connectionId,
              }).pipe(Effect.orDie)
            : Effect.void
        )
      );
      return {
        classes: found.classes,
        connectionId: found.connectionId,
        courses,
      };
    },
    Effect.catchTag("SchemaError", Effect.die)
  )
);

/**
 * Links a Classroom course of the school's connection to one of the school's
 * classes, moves the link to another class, or removes it with no class. A
 * connection or a class of another school is refused as missing. Linking syncs
 * the connection at once, so the course's tasks arrive without waiting.
 */
const link = FunctionImpl.make(
  databaseSchema,
  spec,
  "link",
  Effect.fn("connectors.classroom.link")(function* ({
    classId,
    connectionId,
    courseId,
  }) {
    const { person, tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const connection = yield* reader
      .table("connectorConnections")
      .get(connectionId)
      .pipe(Effect.option);
    if (
      Option.isNone(connection) ||
      connection.value.connector !== "classroom" ||
      connection.value.status !== "active" ||
      connection.value.owner.kind !== "tenant" ||
      connection.value.owner.tenantId !== tenant._id
    ) {
      return yield* missing();
    }
    const existing = yield* reader
      .table("connectorLinks")
      .index("by_connectionId_and_courseId", (query) =>
        query.eq("connectionId", connectionId).eq("courseId", courseId)
      )
      .first()
      .pipe(Effect.orDie);
    if (classId === null) {
      if (Option.isSome(existing)) {
        yield* writer
          .table("connectorLinks")
          .delete(existing.value._id)
          .pipe(Effect.orDie);
      }
      return null;
    }
    const klass = yield* reader
      .table("classes")
      .get(classId)
      .pipe(Effect.option);
    if (Option.isNone(klass) || klass.value.tenantId !== tenant._id) {
      return yield* missing();
    }
    const fields = { classId, personId: person._id };
    yield* (
      Option.isSome(existing)
        ? writer.table("connectorLinks").patch(existing.value._id, fields)
        : writer
            .table("connectorLinks")
            .insert({ ...fields, connectionId, courseId, tenantId: tenant._id })
    ).pipe(Effect.orDie);
    yield* writer
      .table("connectorConnections")
      .patch(connectionId, { nextSyncAt: yield* Clock.currentTimeMillis })
      .pipe(Effect.orDie);
    yield* (yield* Scheduler)
      .runAfter(Duration.zero, refs.internal.connectors.sync.run, {
        connectionId,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

/** The courses a connection has linked, which its sync reads. */
const links = FunctionImpl.make(
  databaseSchema,
  spec,
  "links",
  Effect.fn("connectors.classroom.links")(function* ({ connectionId }) {
    const rows = yield* (yield* DatabaseReader)
      .table("connectorLinks")
      .index("by_connectionId_and_courseId", (query) =>
        query.eq("connectionId", connectionId)
      )
      .take(LINK_LIMIT)
      .pipe(Effect.orDie);
    return Arr.map(rows, (row) => ({ courseId: row.courseId }));
  })
);

/** A Classroom title as a task title: one trimmed line of at most 120 characters, or none when nothing is left. */
const taskTitleOf = (title: string) =>
  Schema.decodeUnknownOption(TaskTitle)(
    Str.trim(Str.slice(Str.trim(title.replace(LINE_BREAKS, " ")), 0, 120))
  );

/**
 * Imports the coursework of one linked course into its class's tasks, each once
 * under a client key made from its Classroom ID, written by the member who linked
 * the course. A task already imported takes a moved deadline. Its text is its
 * description, or its title when it has none, and its points are kept between 0
 * and 1,000. A course no longer linked imports nothing.
 */
const storeWork = FunctionImpl.make(
  databaseSchema,
  spec,
  "storeWork",
  Effect.fn("connectors.classroom.storeWork")(function* ({
    connectionId,
    courseId,
    works,
  }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const found = yield* reader
      .table("connectorLinks")
      .index("by_connectionId_and_courseId", (query) =>
        query.eq("connectionId", connectionId).eq("courseId", courseId)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(found)) {
      return { changed: false };
    }
    const klass = yield* reader
      .table("classes")
      .get(found.value.classId)
      .pipe(Effect.orDie);
    const author = yield* reader
      .table("tenantPeople")
      .get(found.value.personId)
      .pipe(Effect.orDie);
    const changes = yield* Effect.forEach(works, (work) =>
      Effect.gen(function* () {
        const title = taskTitleOf(work.title);
        if (Option.isNone(title)) {
          return false;
        }
        const clientKey = Str.slice(
          `classroom-${work.workId.replace(KEY_UNSAFE, "-")}`,
          0,
          64
        );
        const stored = yield* reader
          .table("classroomTasks")
          .index("by_classId_and_clientKey", (query) =>
            query.eq("classId", klass._id).eq("clientKey", clientKey)
          )
          .first()
          .pipe(Effect.orDie);
        if (Option.isSome(stored)) {
          if (stored.value.deadline === work.deadline) {
            return false;
          }
          yield* writer
            .table("classroomTasks")
            .patch(stored.value._id, { deadline: work.deadline })
            .pipe(Effect.orDie);
          return true;
        }
        yield* writeTask(author, {
          clientKey,
          deadline: work.deadline,
          latePolicy: "accept",
          points: Num.clamp(Num.round(work.points, 0), {
            maximum: 1000,
            minimum: 0,
          }),
          text: Str.slice(
            Str.trim(work.text) === "" ? title.value : Str.trim(work.text),
            0,
            8000
          ),
          title: title.value,
        }).pipe(Effect.provideService(Class, klass));
        return true;
      })
    );
    return { changed: Arr.some(changes, (changed) => changed) };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(canImport),
  Layer.provide(target),
  Layer.provide(preview),
  Layer.provide(link),
  Layer.provide(links),
  Layer.provide(storeWork),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
