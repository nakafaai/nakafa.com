import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { archiveMark } from "@repo/backend/confect/classroom/archive";
import { classTask } from "@repo/backend/confect/classroom/tasks/views";
import { Effect } from "effect";

/**
 * Archives a task of the allowed class, or restores it: an archived task leaves the class's list
 * and its students, and its teacher finds it under the archived tasks; restoring brings it back
 * with its work and its run as they stood.
 */
export const shelveTask = Effect.fn("classroom.tasks.shelve")(function* (
  address: string,
  archived: boolean
) {
  const found = yield* classTask(address, "task.manage");
  const writer = yield* DatabaseWriter;
  yield* writer
    .table("classroomTasks")
    .patch(found._id, { archivedAt: yield* archiveMark(archived) })
    .pipe(Effect.orDie);
});
