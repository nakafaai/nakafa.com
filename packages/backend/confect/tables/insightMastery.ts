import { Table } from "@confect/core";
import { insightMasteryValidator } from "@repo/backend/confect/insight/schema";

/** Each student's standing in each competency in one period, read by student and removed by period. */
export default Table.make(() => insightMasteryValidator)
  .index("by_personId_and_periodId_and_competency", [
    "personId",
    "periodId",
    "competency",
  ])
  .index("by_periodId", ["periodId"]);
