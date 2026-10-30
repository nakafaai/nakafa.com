import type { ClassroomTasksDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { taskField } from "@repo/backend/confect/classroom/tasks/task";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { openText } from "@repo/backend/confect/vault/text";
import { Effect, Option } from "effect";

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

/** One task as the viewer sees it: its text opened with the school key, and the viewer's own work. */
export const taskView = Effect.fn("classroom.tasks.view")(function* (
  task: ClassroomTasksDoc
) {
  const keys = yield* schoolKeys(task.tenantId);
  const mine = yield* ownSubmission(task);
  return {
    deadline: task.deadline,
    handedIn: task.handedIn,
    id: task._id,
    latePolicy: task.latePolicy,
    mine: Option.match(mine, {
      onNone: () => null,
      onSome: (found) => ({
        late: found.late,
        score: found.score ?? null,
        updatedAt: found.updatedAt,
      }),
    }),
    points: task.points,
    slug: task.slug,
    text: yield* openText(keys, taskField(task), task.sealedText).pipe(
      Effect.orDie
    ),
    title: task.title,
  };
});
