import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassroomSubmissionsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import {
  classAccess,
  classAuthority,
} from "@repo/backend/confect/classroom/authority";
import {
  ScoreOutOfRange,
  TaskClosed,
} from "@repo/backend/confect/classroom/errors";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { submissionField } from "@repo/backend/confect/classroom/tasks/task";
import {
  classTask,
  ownSubmission,
  taskView,
} from "@repo/backend/confect/classroom/tasks/views";
import { writeTask } from "@repo/backend/confect/classroom/tasks/write";
import spec from "@repo/backend/confect/classroom/tasks.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

/** One page of the class's tasks by deadline, the soonest first. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.tasks.list")(function* ({ paginationOpts }) {
    const row = yield* Class;
    const found = yield* (yield* DatabaseReader)
      .table("classroomTasks")
      .index("by_classId_and_deadline", (query) => query.eq("classId", row._id))
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(found, {
      page: yield* Effect.forEach(found.page, taskView),
    });
  })
);

/** One task of the class by its address. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("classroom.tasks.get")(function* ({ task }) {
    return yield* taskView(yield* classTask(task, "forum.read"));
  })
);

/**
 * Publishes a task to the class for the teacher (`writeTask`). A repeat of a
 * client key of the class answers that task and writes nothing.
 */
const publish = FunctionImpl.make(
  databaseSchema,
  spec,
  "publish",
  Effect.fn("classroom.tasks.publish")(function* (args) {
    const { person } = yield* Member;
    return yield* taskView(
      yield* writeTask(person, Struct.omit(args, ["classId", "slug"]))
    );
  })
);

/** Moves the deadline of a task, and records `assignment.deadlineChanged`. */
const reschedule = FunctionImpl.make(
  databaseSchema,
  spec,
  "reschedule",
  Effect.fn("classroom.tasks.reschedule")(function* ({ deadline, task }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const found = yield* classTask(task, "task.manage");
    const moved = Struct.assign(found, { deadline });
    yield* (yield* DatabaseWriter)
      .table("classroomTasks")
      .replace(found._id, Struct.omit(moved, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    yield* classAuthority.record(personActor(person), row, {
      task: found._id,
      type: "assignment.deadlineChanged",
    });
    return yield* taskView(moved);
  })
);

/**
 * Hands in the student's work, sealed with the school key, or replaces what the
 * student handed in before. Work after the deadline is marked late, and a task
 * that closes at its deadline refuses it. The first work of a student counts in
 * the task's number of work handed in.
 */
const submit = FunctionImpl.make(
  databaseSchema,
  spec,
  "submit",
  Effect.fn("classroom.tasks.submit")(function* ({ task, text }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const found = yield* classTask(task, "task.submit");
    const now = yield* Clock.currentTimeMillis;
    const late = now > found.deadline;
    if (late && found.latePolicy === "close") {
      return yield* new TaskClosed();
    }
    const writer = yield* DatabaseWriter;
    const fields = { personId: person._id, taskId: found._id };
    const sealedText = yield* sealText(
      yield* schoolKeys(row.tenantId),
      submissionField(fields),
      text
    ).pipe(Effect.orDie);
    const existing = yield* ownSubmission(found);
    if (Option.isSome(existing)) {
      yield* writer
        .table("classroomSubmissions")
        .replace(
          existing.value._id,
          Struct.assign(Struct.omit(existing.value, ["_creationTime", "_id"]), {
            late,
            sealedText,
            updatedAt: now,
          })
        )
        .pipe(Effect.orDie);
      return yield* taskView(found);
    }
    yield* writer
      .table("classroomSubmissions")
      .insert({
        ...fields,
        classId: row._id,
        createdAt: now,
        late,
        sealedText,
        tenantId: row.tenantId,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    const counted = Struct.assign(found, { handedIn: found.handedIn + 1 });
    yield* writer
      .table("classroomTasks")
      .replace(found._id, Struct.omit(counted, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    return yield* taskView(counted);
  })
);

/** The views of some work for its teacher: each text opened with the school key, each student's name read once. */
const submissionViews = Effect.fn("classroom.tasks.submissionViews")(function* (
  rows: readonly ClassroomSubmissionsDoc[]
) {
  const row = yield* Class;
  const reader = yield* DatabaseReader;
  const keys = yield* schoolKeys(row.tenantId);
  return yield* Effect.forEach(rows, (submission) =>
    Effect.gen(function* () {
      const person = yield* reader
        .table("tenantPeople")
        .get(submission.personId);
      return {
        id: submission._id,
        late: submission.late,
        person: { id: person._id, name: person.name },
        score: submission.score ?? null,
        text: yield* openText(
          keys,
          submissionField(submission),
          submission.sealedText
        ),
        updatedAt: submission.updatedAt,
      };
    }).pipe(Effect.orDie)
  );
});

/** One page of the work handed in for a task, as its teacher reads it. */
const submissions = FunctionImpl.make(
  databaseSchema,
  spec,
  "submissions",
  Effect.fn("classroom.tasks.submissions")(function* ({
    paginationOpts,
    task,
  }) {
    const found = yield* classTask(task, "task.manage");
    const page = yield* (yield* DatabaseReader)
      .table("classroomSubmissions")
      .index("by_taskId_and_personId", (query) => query.eq("taskId", found._id))
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(page, { page: yield* submissionViews(page.page) });
  })
);

/** Gives a student's work its points, at most the points its task is worth. */
const score = FunctionImpl.make(
  databaseSchema,
  spec,
  "score",
  Effect.fn("classroom.tasks.score")(function* ({ points, submissionId }) {
    const row = yield* Class;
    const reader = yield* DatabaseReader;
    const submission = yield* reader
      .table("classroomSubmissions")
      .get(submissionId)
      .pipe(Effect.option);
    if (Option.isNone(submission) || submission.value.classId !== row._id) {
      return yield* new AccessDenied({
        action: "task.manage",
        reason: "resource",
      });
    }
    const task = yield* reader
      .table("classroomTasks")
      .get(submission.value.taskId)
      .pipe(Effect.orDie);
    if (points > task.points) {
      return yield* new ScoreOutOfRange();
    }
    const scored = Struct.assign(submission.value, { score: points });
    yield* (yield* DatabaseWriter)
      .table("classroomSubmissions")
      .replace(scored._id, Struct.omit(scored, ["_creationTime", "_id"]))
      .pipe(Effect.orDie);
    return Arr.getUnsafe(yield* submissionViews([scored]), 0);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(get),
  Layer.provide(publish),
  Layer.provide(reschedule),
  Layer.provide(submit),
  Layer.provide(submissions),
  Layer.provide(score),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
