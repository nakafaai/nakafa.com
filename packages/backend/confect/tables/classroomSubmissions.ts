import { Table } from "@confect/core";
import { submissionValidator } from "@repo/backend/confect/classroom/tasks/task";

/** The work handed in for each task, one row for each student, read by task. */
export default Table.make(() => submissionValidator).index(
  "by_taskId_and_personId",
  ["taskId", "personId"]
);
