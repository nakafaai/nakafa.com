import { Table } from "@confect/core";
import { integrationTokenValidator } from "@repo/backend/confect/integrations/schema";

/** Access tokens of integration clients, read by digest for each request, by client to end them, and by expiry for the sweep. */
export default Table.make(() => integrationTokenValidator)
  .index("by_tokenHash", ["tokenHash"])
  .index("by_clientId", ["clientId"])
  .index("by_expiresAt", ["expiresAt"]);
