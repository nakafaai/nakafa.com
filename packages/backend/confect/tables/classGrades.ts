import { Table } from "@confect/core";
import { gradeValidator } from "@repo/backend/confect/records/grade";

/** The final grades of a class, read by class for its list and by student for the grade of one class. */
export default Table.make(() => gradeValidator)
  .index("by_classId_and_personId", ["classId", "personId"])
  .index("by_personId_and_periodId", ["personId", "periodId"]);
