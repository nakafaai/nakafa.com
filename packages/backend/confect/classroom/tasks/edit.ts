import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import { TaskPointsFixed } from "@repo/backend/confect/classroom/errors";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import {
  type LatePolicy,
  taskField,
} from "@repo/backend/confect/classroom/tasks/task";
import { classTask } from "@repo/backend/confect/classroom/tasks/views";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { moveTaskNotices } from "@repo/backend/confect/notifications/tasks";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { Effect, Struct } from "effect";

/**
 * Changes a task of the allowed class: its title, what it asks, its deadline, its points, and what late work gets.
 * The task keeps its address, so every link to it still opens it, and its text is sealed again with the school key.
 * Its points are fixed once work is handed in, because the students already work toward them. A moved deadline
 * records `assignment.deadlineChanged`, which the class sees, and any other change records `assignment.edited`.
 */
export const editTask = Effect.fn("classroom.tasks.edit")(function* (args: {
  readonly deadline: number;
  readonly latePolicy: typeof LatePolicy.Type;
  readonly points: number;
  readonly task: string;
  readonly text: string;
  readonly title: string;
}) {
  const { person } = yield* Member;
  const row = yield* Class;
  const found = yield* classTask(args.task, "task.manage");
  if (args.points !== found.points && found.handedIn > 0) {
    return yield* new TaskPointsFixed();
  }
  const keys = yield* schoolKeys(row.tenantId);
  const before = yield* openText(keys, taskField(found), found.sealedText).pipe(
    Effect.orDie
  );
  const moved =
    args.deadline === found.deadline
      ? {}
      : {
          jobs: yield* moveTaskNotices(
            { ...found, deadline: args.deadline },
            row.unitId
          ),
        };
  const edited = Struct.assign(found, {
    ...moved,
    deadline: args.deadline,
    latePolicy: args.latePolicy,
    points: args.points,
    sealedText: yield* sealText(keys, taskField(found), args.text).pipe(
      Effect.orDie
    ),
    title: args.title,
  });
  yield* (yield* DatabaseWriter)
    .table("classroomTasks")
    .replace(found._id, Struct.omit(edited, ["_creationTime", "_id"]))
    .pipe(Effect.orDie);
  const actor = personActor(person);
  if (args.deadline !== found.deadline) {
    yield* classAuthority.record(actor, row, {
      task: found._id,
      type: "assignment.deadlineChanged",
    });
  }
  const content =
    args.title !== found.title ||
    args.text !== before ||
    args.points !== found.points ||
    args.latePolicy !== found.latePolicy;
  if (content) {
    yield* classAuthority.record(actor, row, {
      task: found._id,
      type: "assignment.edited",
    });
  }
  return edited;
});
