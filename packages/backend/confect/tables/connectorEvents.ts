import { Table } from "@confect/core";
import { connectorEventValidator } from "@repo/backend/confect/connectors/schema";

/** The Calendar mirror: each connection's events by start, and an account's upcoming events by start. */
export default Table.make(() => connectorEventValidator)
  .index("by_connectionId_and_start", ["connectionId", "start"])
  .index("by_userId_and_start", ["userId", "start"]);
