import { Table } from "@confect/core";
import { classTeacherValidator } from "@repo/backend/confect/classroom/teacher";
/** The subject teachers of each class, read by class for the roster and by Person for the teaching of a period. */
export default Table.make(() => classTeacherValidator)
  .index("by_classId_and_personId", ["classId", "personId"])
  .index("by_personId_and_periodId", ["personId", "periodId"]);
