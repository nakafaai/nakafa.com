import { Table } from "@confect/core";
import { insightDraftValidator } from "@repo/backend/confect/insight/schema";

/** Nina's drafts of narratives, read by class and student and removed by period. */
export default Table.make(() => insightDraftValidator)
  .index("by_classId_and_personId", ["classId", "personId"])
  .index("by_periodId", ["periodId"]);
