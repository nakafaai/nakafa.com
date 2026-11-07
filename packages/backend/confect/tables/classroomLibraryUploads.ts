import { Table } from "@confect/core";
import { reservationValidator } from "@repo/backend/confect/classroom/library/reserve";

/** The library uploads that reserved their bytes and have not been registered yet, found by their client key, oldest first for the daily sweep. */
export default Table.make(() => reservationValidator)
  .index("by_classId_and_clientKey", ["classId", "clientKey"])
  .index("by_createdAt", ["createdAt"]);
