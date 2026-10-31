import { Table } from "@confect/core";
import { insightMasteryValidator } from "@repo/backend/confect/insight/schema";

/** Each student's standing in each competency, read by student. */
export default Table.make(() => insightMasteryValidator).index(
  "by_personId_and_competency",
  ["personId", "competency"]
);
