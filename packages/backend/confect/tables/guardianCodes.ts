import { Table } from "@confect/core";
import { guardianCodeValidator } from "@repo/backend/confect/guardians/schema";

/** The live sign-in code of one address at one school, and the sweep of expired codes. */
export default Table.make(() => guardianCodeValidator)
  .index("by_tenantId_and_email", ["tenantId", "email"])
  .index("by_expiresAt", ["expiresAt"]);
