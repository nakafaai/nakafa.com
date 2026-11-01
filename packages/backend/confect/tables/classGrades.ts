import { Table } from "@confect/core";
import { gradeValidator } from "@repo/backend/confect/records/grade";

/** The final grades of a class, read by class for its list, by student for the grade of one class, and by period for a client, and by scheme to tell whether one judged a grade. */
export default Table.make(() => gradeValidator)
  .index("by_classId_and_personId", ["classId", "personId"])
  .index("by_personId_and_periodId", ["personId", "periodId"])
  .index("by_periodId_and_state", ["periodId", "state"])
  .index("by_schemeId", ["schemeId"]);
