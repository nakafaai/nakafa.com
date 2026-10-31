import { Table } from "@confect/core";
import { integrationRequestValidator } from "@repo/backend/confect/integrations/schema";

/** The idempotent writes of integration clients, read by key for a repeat and by expiry for the sweep. */
export default Table.make(() => integrationRequestValidator)
  .index("by_clientId_and_key", ["clientId", "key"])
  .index("by_expiresAt", ["expiresAt"]);
