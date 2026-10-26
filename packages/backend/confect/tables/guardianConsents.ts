import { Table } from "@confect/core";
import { guardianConsentValidator } from "@repo/backend/confect/guardians/schema";

/** The append-only consent ledger, read by link for a school's evidence of one link. */
export default Table.make(() => guardianConsentValidator).index("by_linkId", [
  "linkId",
]);
