import { Table } from "@confect/core";
import { connectorSecretValidator } from "@repo/backend/confect/connectors/schema";

/** The sealed refresh tokens of connections, one row for each, read by their connection. */
export default Table.make(() => connectorSecretValidator).index(
  "by_connectionId",
  ["connectionId"]
);
