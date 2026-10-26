import { Table } from "@confect/core";
import { integrationDeviceValidator } from "@repo/backend/confect/integrations/schema";

/** The device authorizations of the device grant, read by device code, by school and user code, and by expiry for the sweep. */
export default Table.make(() => integrationDeviceValidator)
  .index("by_deviceCodeHash", ["deviceCodeHash"])
  .index("by_tenantId_and_userCode", ["tenantId", "userCode"])
  .index("by_expiresAt", ["expiresAt"]);
