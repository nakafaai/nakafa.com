import { Table } from "@confect/core";
import { classTeacherValidator } from "@repo/backend/confect/classroom/teacher";
export default Table.make(() => classTeacherValidator)
  .index("by_classId_and_personId", ["classId", "personId"])
  .index("by_personId_and_periodId", ["personId", "periodId"]);
