import { Table } from "@confect/core";
import { graduationValidator } from "@repo/backend/confect/records/graduation";

/** The graduation decision of each unit's period, read by period on every graduation page and issue. */
export default Table.make(() => graduationValidator).index("by_periodId", [
  "periodId",
]);
