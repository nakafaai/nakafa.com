import { Table } from "@confect/core";
import { tenantInviteValidator } from "@repo/backend/confect/tenancy/schema";
export default Table.make(() => tenantInviteValidator)
  .index("by_channel_email_and_state_status", ["channel.email", "state.status"])
  .index("by_personId_and_state_status", ["personId", "state.status"]);
