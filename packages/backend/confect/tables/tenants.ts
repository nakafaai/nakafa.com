import { Table } from "@confect/core";
import { tenantValidator } from "@repo/backend/confect/tenancy/schema";
export default Table.make(() => tenantValidator).index("by_slug", ["slug"]);
