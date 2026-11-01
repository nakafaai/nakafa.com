import type { ClassroomTasksDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { mayIn } from "@repo/backend/confect/classroom/roster";
import {
  submissionField,
  taskField,
} from "@repo/backend/confect/classroom/tasks/task";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { openText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Option } from "effect";

/** The task of the allowed class at `slug`, refused as a missing object when the class holds none. */
export const classTask = Effect.fn("classroom.tasks.lookup")(function* (
  slug: string,
  action: "forum.read" | "task.manage" | "task.submit"
) {
  const row = yield* Class;
  const task = yield* (yield* DatabaseReader)
    .table("classroomTasks")
    .index("by_classId_and_slug", (query) =>
      query.eq("classId", row._id).eq("slug", slug)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(task)) {
    return yield* new AccessDenied({ action, reason: "resource" });
  }
  return task.value;
});

/**
 * Whether the viewer is a student of the class, who reads only the tasks that reach them. Whoever teaches or leads the
 * class reads every task.
 */
export const readsAsStudent = Effect.fn("classroom.tasks.asStudent")(
  function* () {
    return yield* mayIn("task.submit", yield* Class, yield* Member);
  }
);

/** Whether a task goes to a Person: to the whole class, or to the students that name them. */
export const reaches = (
  task: Pick<ClassroomTasksDoc, "targets">,
  personId: ClassroomTasksDoc["authorId"]
) => task.targets === undefined || Arr.contains(task.targets, personId);

/** The task at `slug` as `classTask` finds it, refused as a missing object for a student it does not reach. */
export const taskForViewer = Effect.fn("classroom.tasks.forViewer")(function* (
  slug: string,
  action: "forum.read" | "task.submit"
) {
  const task = yield* classTask(slug, action);
  const { person } = yield* Member;
  if (reaches(task, person._id) || !(yield* readsAsStudent())) {
    return task;
  }
  return yield* new AccessDenied({ action, reason: "resource" });
});

/** The work the viewer handed in for a task, if any. */
export const ownSubmission = Effect.fn("classroom.tasks.own")(function* (
  task: ClassroomTasksDoc
) {
  const { person } = yield* Member;
  return yield* (yield* DatabaseReader)
    .table("classroomSubmissions")
    .index("by_taskId_and_personId", (query) =>
      query.eq("taskId", task._id).eq("personId", person._id)
    )
    .first()
    .pipe(Effect.orDie);
});

/** One task as the viewer sees it: its text and the viewer's own work, each opened with the school key. */
export const taskView = Effect.fn("classroom.tasks.view")(function* (
  task: ClassroomTasksDoc
) {
  const keys = yield* schoolKeys(task.tenantId);
  const mine = yield* ownSubmission(task);
  return {
    category: task.category ?? null,
    deadline: task.deadline,
    handedIn: task.handedIn,
    id: task._id,
    latePolicy: task.latePolicy,
    mine: yield* Option.match(mine, {
      onNone: () => Effect.succeed(null),
      onSome: (found) =>
        Effect.map(
          openText(keys, submissionField(found), found.sealedText),
          (text) => ({
            late: found.late,
            score: found.score ?? null,
            text,
            updatedAt: found.updatedAt,
          })
        ),
    }).pipe(Effect.orDie),
    points: task.points,
    slug: task.slug,
    targets: task.targets ?? null,
    text: yield* openText(keys, taskField(task), task.sealedText).pipe(
      Effect.orDie
    ),
    title: task.title,
  };
});
