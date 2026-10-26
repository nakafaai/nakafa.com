import { Table } from "@confect/core";
import { rosterEntryValidator } from "@repo/backend/confect/roster/schema";

/**
 * One roster row per student: read by Person for the consent gate and the guardian check,
 * and by the blind of its NISN for an import, which finds the student a file names.
 */
export default Table.make(() => rosterEntryValidator)
  .index("by_personId", ["personId"])
  .index("by_tenantId_and_nisn_blind", ["tenantId", "nisn.blind"]);
