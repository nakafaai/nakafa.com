import { Table } from "@confect/core";
import { schoolValidator } from "@repo/backend/confect/schools/schema";
/**
 * School type validator
 */
export default Table.make(() => schoolValidator)
  .index("by_slug", ["slug"])
  .index("by_email", ["email"])
  .index("by_createdBy", ["createdBy"]);
