import { Table } from "@confect/core";
import { fileValidator } from "@repo/backend/confect/bucket/row";

/** The files of the private R2 bucket, by state and age for the daily sweep of uploads that never arrived. */
export default Table.make(() => fileValidator).index("by_state_and_createdAt", [
  "state",
  "createdAt",
]);
