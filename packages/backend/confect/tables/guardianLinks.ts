import { Table } from "@confect/core";
import { guardianLinkValidator } from "@repo/backend/confect/guardians/schema";

/**
 * Guardian links, read by school for the staff list, by address for a code, by
 * guardian for the parent home, and by student and state for the consent gate.
 */
export default Table.make(() => guardianLinkValidator)
  .index("by_tenantId", ["tenantId"])
  .index("by_tenantId_and_email", ["tenantId", "email"])
  .index("by_guardianPersonId", ["guardianPersonId"])
  .index("by_studentPersonId_and_state_status", [
    "studentPersonId",
    "state.status",
  ])
  .index("by_state_status_and_expiresAt", ["state.status", "expiresAt"]);
