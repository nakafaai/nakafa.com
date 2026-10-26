import { Table } from "@confect/core";
import { rosterEntryValidator } from "@repo/backend/confect/roster/schema";

/** One roster row per student: read by Person for the consent gate and the guardian check. */
export default Table.make(() => rosterEntryValidator).index("by_personId", [
  "personId",
]);
