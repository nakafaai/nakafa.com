import { Table } from "@confect/core";
import { integrationDeliveryValidator } from "@repo/backend/confect/integrations/hook";

/** One row for each attempt to deliver a change, read by webhook and swept while due. */
export default Table.make(() => integrationDeliveryValidator)
  .index("by_webhookId", ["webhookId"])
  .index("by_state_status_and_dueAt", ["state.status", "dueAt"]);
