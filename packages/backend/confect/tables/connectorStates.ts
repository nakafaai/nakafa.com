import { Table } from "@confect/core";
import { connectStateValidator } from "@repo/backend/confect/connectors/schema";

/** The connects that wait for Google's callback, found by their state, and an account's own by `by_userId`. */
export default Table.make(() => connectStateValidator)
  .index("by_state", ["state"])
  .index("by_userId", ["userId"]);
