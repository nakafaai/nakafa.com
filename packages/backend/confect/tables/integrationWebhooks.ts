import { Table } from "@confect/core";
import { integrationWebhookValidator } from "@repo/backend/confect/integrations/hook";

/** Webhooks of integration clients, listed by school, ended by client, and swept by status. */
export default Table.make(() => integrationWebhookValidator)
  .index("by_tenantId", ["tenantId"])
  .index("by_clientId_and_status", ["clientId", "status"])
  .index("by_status", ["status"]);
