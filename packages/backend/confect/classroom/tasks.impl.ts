import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassroomSubmissionsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import {
  ScoreOutOfRange,
  TaskClosed,
} from "@repo/backend/confect/classroom/errors";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { editTask } from "@repo/backend/confect/classroom/tasks/edit";
import {
  standingOf,
  submissionField,
} from "@repo/backend/confect/classroom/tasks/task";
import {
  classTask,
  ownSubmission,
  reaches,
  readsAsStudent,
  taskForViewer,
  taskView,
} from "@repo/backend/confect/classroom/tasks/views";
import {
  classTargets,
  writeTask,
} from "@repo/backend/confect/classroom/tasks/write";
import spec from "@repo/backend/confect/classroom/tasks.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { namedPeople } from "@repo/backend/confect/tenancy/named";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

/**
 * One page of the class's tasks by deadline, the soonest first, leaving out for a student the tasks that go to other
 * students of the class, so a page can hold fewer tasks than it read. A `standing` keeps the tasks where the reader's own
 * work stands so (`standingOf`), so a page can hold fewer tasks than it read.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classroom.tasks.list")(function* ({ paginationOpts, standing }) {
    const { person } = yield* Member;
    const row = yield* Class;
    const found = yield* (yield* DatabaseReader)
      .table("classroomTasks")
      .index("by_classId_and_deadline", (query) => query.eq("classId", row._id))
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const narrowed = Arr.some(found.page, (task) => !reaches(task, person._id));
    const reached =
      narrowed && (yield* readsAsStudent())
        ? Arr.filter(found.page, (task) => reaches(task, person._id))
        : found.page;
    const views = yield* Effect.forEach(reached, taskView);
    return Struct.assign(found, {
      page:
        standing === undefined
          ? views
          : Arr.filter(views, (view) => standingOf(view.mine) === standing),
    });
  })
);

/** One task of the class by its address. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("classroom.tasks.get")(function* ({ task }) {
    return yield* taskView(yield* taskForViewer(task, "forum.read"));
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
      yield* writeTask(
        person,
        Struct.omit(args, ["classId", "slug", "targets"]),
        yield* classTargets(args.targets)
      )
    );
  })
);

/** Edits a task of the class for the teacher (`editTask`), and answers it as the teacher now reads it. */
const edit = FunctionImpl.make(
  databaseSchema,
  spec,
  "edit",
  Effect.fn("classroom.tasks.edit.function")(function* (args) {
    return yield* taskView(
      yield* editTask(Struct.omit(args, ["classId", "slug"]))
    );
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
    const found = yield* taskForViewer(task, "task.submit");
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

/**
 * One page of the work handed in for a task, as its teacher reads it. A `search` reads the school's people whose
 * names match it, best match first (`namedPeople`), and keeps those who handed work in, so a page of a search can
 * hold less work than it read.
 */
const submissions = FunctionImpl.make(
  databaseSchema,
  spec,
  "submissions",
  Effect.fn("classroom.tasks.submissions")(function* ({
    paginationOpts,
    search,
    task,
  }) {
    const found = yield* classTask(task, "task.manage");
    const table = (yield* DatabaseReader).table("classroomSubmissions");
    if (search !== undefined) {
      const people = yield* namedPeople(
        (yield* Class).tenantId,
        search,
        paginationOpts
      );
      const work = yield* Effect.forEach(
        people.page,
        (person) =>
          table
            .index("by_taskId_and_personId", (query) =>
              query.eq("taskId", found._id).eq("personId", person._id)
            )
            .first()
            .pipe(Effect.orDie),
        { concurrency: "unbounded" }
      );
      return Struct.assign(people, {
        page: yield* submissionViews(Arr.getSomes(work)),
      });
    }
    const page = yield* table
      .index("by_taskId_and_personId", (query) => query.eq("taskId", found._id))
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(page, { page: yield* submissionViews(page.page) });
  })
);

/**
 * One page of the students a task reaches who have handed nothing in, as its teacher reads them. It walks the
 * students placed in the class's cohort, so a page can hold fewer students than it read.
 */
const missing = FunctionImpl.make(
  databaseSchema,
  spec,
  "missing",
  Effect.fn("classroom.tasks.missing")(function* ({ paginationOpts, task }) {
    const found = yield* classTask(task, "task.manage");
    const row = yield* Class;
    const reader = yield* DatabaseReader;
    const page = yield* reader
      .table("tenantCohortMembers")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", row.cohortId)
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const students = yield* Effect.forEach(
      Arr.dedupe(Arr.map(page.page, (member) => member.personId)),
      (personId) =>
        Effect.gen(function* () {
          const person = yield* reader.table("tenantPeople").get(personId);
          const handedIn = yield* reader
            .table("classroomSubmissions")
            .index("by_taskId_and_personId", (query) =>
              query.eq("taskId", found._id).eq("personId", personId)
            )
            .first();
          return person.status === "active" &&
            reaches(found, personId) &&
            Option.isNone(handedIn)
            ? Option.some({ id: person._id, name: person.name })
            : Option.none();
        }).pipe(Effect.orDie),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: Arr.getSomes(students) });
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
  Layer.provide(edit),
  Layer.provide(submit),
  Layer.provide(submissions),
  Layer.provide(missing),
  Layer.provide(score),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
