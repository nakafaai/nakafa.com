import { Table } from "@confect/core";
import { gradingSchemeValidator } from "@repo/backend/confect/records/scheme";

/** The dated versions of each school's grading scheme, read by the newest version in force at a time. */
export default Table.make(() => gradingSchemeValidator).index(
  "by_tenantId_and_effectiveFrom",
  ["tenantId", "effectiveFrom"]
);
