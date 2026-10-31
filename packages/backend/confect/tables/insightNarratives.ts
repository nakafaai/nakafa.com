import { Table } from "@confect/core";
import { insightNarrativeValidator } from "@repo/backend/confect/insight/schema";

/** What teachers say about a student, read by class and by student. */
export default Table.make(() => insightNarrativeValidator)
  .index("by_classId_and_personId", ["classId", "personId"])
  .index("by_personId", ["personId"]);
