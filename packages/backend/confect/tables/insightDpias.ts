import { Table } from "@confect/core";
import { insightDpiaValidator } from "@repo/backend/confect/insight/schema";

/** Each school's impact assessments, the newest in force. */
export default Table.make(() => insightDpiaValidator).index(
  "by_tenantId_and_recordedAt",
  ["tenantId", "recordedAt"]
);
