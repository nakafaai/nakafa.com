import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** The notices of a task: its deadline nears for the students, or passed for the guardians of those who did not hand in. */
export const TaskNotice = Schema.Literals(["taskDeadline", "taskMissed"]);

/**
 * Writes the inbox rows of a task's deadline, one page of the class's students per run (ADR 0027). Publishing a task
 * schedules the first run of each notice at the time the rules give it, and moving the deadline cancels the runs that
 * have not started and schedules new ones. It is internal.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({
      cursor: Schema.NullOr(Schema.String),
      notice: TaskNotice,
      taskId: Id("classroomTasks"),
    }),
    returns: () => Schema.Null,
  })
);
