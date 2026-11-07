import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { classTask } from "@repo/backend/confect/classroom/tasks/views";
import { cancelTaskNotices } from "@repo/backend/confect/notifications/tasks";
import { Effect } from "effect";

/**
 * Deletes a task of the allowed class for good: its pending deadline notices are cancelled, the
 * work handed in for it is deleted, then the task. A notice that already reached a student opens
 * the task's missing state, and a fan-out still running finds no task and sends nothing more.
 */
export const removeTask = Effect.fn("classroom.tasks.remove")(function* (
  address: string
) {
  const found = yield* classTask(address, "task.manage");
  yield* cancelTaskNotices(found);
  const writer = yield* DatabaseWriter;
  const work = yield* (yield* DatabaseReader)
    .table("classroomSubmissions")
    .index("by_taskId_and_personId", (query) => query.eq("taskId", found._id))
    .collect()
    .pipe(Effect.orDie);
  yield* Effect.forEach(
    work,
    (submission) =>
      writer
        .table("classroomSubmissions")
        .delete(submission._id)
        .pipe(Effect.orDie),
    { discard: true }
  );
  yield* writer.table("classroomTasks").delete(found._id).pipe(Effect.orDie);
});
